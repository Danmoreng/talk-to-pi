#include "transcription_engine.hpp"

#include <stdexcept>

namespace talk_to_pi {

TranscriptionEngine::~TranscriptionEngine() {
    cancel();
    if (recognizer_) nemo_speech_asr_destroy(recognizer_);
}

bool TranscriptionEngine::load(const std::string& model_path, std::string& error) {
    cancel();
    if (recognizer_) {
        nemo_speech_asr_destroy(recognizer_);
        recognizer_ = nullptr;
    }

    nemo_speech_asr_backend_config backend{};
    backend.size = sizeof(backend);
    backend.gpu = TALK_TO_PI_ENABLE_CUDA ? 0 : -1;

    nemo_speech_asr_model_config model{};
    model.size = sizeof(model);
    model.path = model_path.c_str();

    nemo_speech_asr_streaming_config streaming{};
    streaming.size = sizeof(streaming);
    streaming.chunk_size = 0.16F;
    streaming.ctc_left_padding = 1.92F;
    streaming.ctc_right_padding = 1.92F;
    streaming.rnnt_right_context = -1;

    nemo_speech_asr_recognizer_config config{};
    config.size = sizeof(config);
    config.backend = &backend;
    config.model = &model;
    config.streaming = &streaming;

    const auto status = nemo_speech_asr_create(&config, &recognizer_);
    if (!check(status, "nemo_speech_asr_create", error)) {
        recognizer_ = nullptr;
        return false;
    }
    return true;
}

bool TranscriptionEngine::begin(const std::string& language, std::string& error) {
    cancel();
    if (!recognizer_) {
        error = "NeMo ASR recognizer is not loaded.";
        return false;
    }

    language_ = language;
    options_ = nemo_speech_asr_recognition_options_default();
    options_.language_code = language_.c_str();
    options_.interim_results = true;
    options_.enable_automatic_punctuation = true;

    const auto status = nemo_speech_asr_streaming_recognize(recognizer_, &options_, &stream_);
    if (!check(status, "nemo_speech_asr_streaming_recognize", error)) {
        stream_ = nullptr;
        return false;
    }
    cumulative_text_.clear();
    return true;
}

bool TranscriptionEngine::feed(const float* samples, int count, FeedResult& result, std::string& error) {
    result = {};
    result.audio_samples = count;
    if (!stream_) {
        error = "NeMo ASR stream is not active.";
        return false;
    }
    const auto status = nemo_speech_asr_stream_push_f32(stream_, samples, static_cast<std::size_t>(count), 16000);
    if (!check(status, "nemo_speech_asr_stream_push_f32", error)) return false;
    return collect_results(result, error);
}

bool TranscriptionEngine::finalize(FeedResult& result, std::string& error) {
    result = {};
    if (!stream_) {
        error = "NeMo ASR stream is not active.";
        return false;
    }
    const auto status = nemo_speech_asr_stream_finish(stream_);
    if (!check(status, "nemo_speech_asr_stream_finish", error)) return false;
    const bool collected = collect_results(result, error);
    nemo_speech_asr_stream_close(stream_);
    stream_ = nullptr;
    return collected;
}

void TranscriptionEngine::cancel() {
    if (stream_) {
        nemo_speech_asr_stream_close(stream_);
        stream_ = nullptr;
    }
    cumulative_text_.clear();
}

bool TranscriptionEngine::collect_results(FeedResult& result, std::string& error) {
    std::string latest_text;
    bool got_result = false;
    for (;;) {
        nemo_speech_asr_result* native_result = nullptr;
        const auto status = nemo_speech_asr_stream_next(stream_, &native_result);
        if (!check(status, "nemo_speech_asr_stream_next", error)) return false;
        if (!native_result) break;

        got_result = true;
        const char* text = nemo_speech_asr_result_transcript(native_result, 0);
        if (text) latest_text = text;
        nemo_speech_asr_result_destroy(native_result);
    }

    // NeMo interim results are cumulative and may revise punctuation or words.
    // The protocol therefore carries the complete current hypothesis so the
    // Pi overlay can replace it rather than appending revisions as new text.
    if (got_result) {
        cumulative_text_ = latest_text;
        result.text = cumulative_text_;
        result.cumulative_text = true;
    }
    return true;
}

bool TranscriptionEngine::check(nemo_speech_asr_status status, const char* operation,
                                std::string& error) const {
    if (status == NEMO_SPEECH_ASR_OK) return true;
    const char* detail = nemo_speech_asr_last_error();
    error = std::string(operation) + " failed: " + (detail ? detail : "unknown error");
    return false;
}

} // namespace talk_to_pi
