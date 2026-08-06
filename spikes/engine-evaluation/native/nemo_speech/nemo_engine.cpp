#include "nemo_engine.hpp"

#include <stdexcept>

namespace talk_to_pi::evaluation {

NemoSpeechEngine::~NemoSpeechEngine() { reset(); }

std::string NemoSpeechEngine::version() const {
    return nemo_speech_asr_version() ? nemo_speech_asr_version() : "unknown";
}

void NemoSpeechEngine::load(const EvaluationEngineConfig& config) {
    reset();
    config_ = config;
    language_ = config.language;

    nemo_speech_asr_backend_config backend{};
    backend.size = sizeof(backend);
    backend.gpu = -1;
    nemo_speech_asr_model_config model{};
    model.size = sizeof(model);
    model.path = config_.model_path.c_str();
    nemo_speech_asr_streaming_config streaming{};
    streaming.size = sizeof(streaming);
    streaming.chunk_size = 0.16f;
    streaming.ctc_left_padding = 1.92f;
    streaming.ctc_right_padding = 1.92f;
    streaming.rnnt_right_context = config_.right_context_frames;
    nemo_speech_asr_recognizer_config recognizer_config{};
    recognizer_config.size = sizeof(recognizer_config);
    recognizer_config.backend = &backend;
    recognizer_config.model = &model;
    recognizer_config.streaming = &streaming;

    const auto status = nemo_speech_asr_create(&recognizer_config, &recognizer_);
    if (status != NEMO_SPEECH_ASR_OK || !recognizer_)
        throw_last_error("nemo_speech_asr_create");
}

void NemoSpeechEngine::start_stream() {
    if (!recognizer_) throw std::runtime_error("NeMo engine is not loaded");
    options_ = nemo_speech_asr_recognition_options_default();
    options_.language_code = language_.c_str();
    options_.interim_results = true;
    options_.enable_automatic_punctuation = true;
    const auto status = nemo_speech_asr_streaming_recognize(recognizer_, &options_, &stream_);
    if (status != NEMO_SPEECH_ASR_OK || !stream_)
        throw_last_error("nemo_speech_asr_streaming_recognize");
}

void NemoSpeechEngine::push_audio(const float* samples, std::size_t count, int sample_rate) {
    if (!stream_) throw std::runtime_error("NeMo stream is not active");
    const auto status = nemo_speech_asr_stream_push_f32(stream_, samples, count, sample_rate);
    if (status != NEMO_SPEECH_ASR_OK) throw_last_error("nemo_speech_asr_stream_push_f32");
}

std::vector<EvaluationHypothesis> NemoSpeechEngine::poll() { return drain_results(); }

std::vector<EvaluationHypothesis> NemoSpeechEngine::finish() {
    if (!stream_) return {};
    const auto status = nemo_speech_asr_stream_finish(stream_);
    if (status != NEMO_SPEECH_ASR_OK) throw_last_error("nemo_speech_asr_stream_finish");
    return drain_results();
}

std::vector<EvaluationHypothesis> NemoSpeechEngine::drain_results() {
    std::vector<EvaluationHypothesis> output;
    if (!stream_) return output;
    for (;;) {
        nemo_speech_asr_result* result = nullptr;
        const auto status = nemo_speech_asr_stream_next(stream_, &result);
        if (status != NEMO_SPEECH_ASR_OK) throw_last_error("nemo_speech_asr_stream_next");
        if (!result) break;
        const char* text = nemo_speech_asr_result_transcript(result, 0);
        EvaluationHypothesis hypothesis;
        hypothesis.raw_text = text ? text : "";
        hypothesis.normalized_text = normalize_display_text(hypothesis.raw_text);
        hypothesis.is_final = nemo_speech_asr_result_is_final(result);
        hypothesis.is_engine_stable = hypothesis.is_final;
        hypothesis.audio_processed_ms =
            nemo_speech_asr_result_audio_processed(result) * 1000.0;
        output.push_back(std::move(hypothesis));
        nemo_speech_asr_result_destroy(result);
    }
    return output;
}

std::vector<EvaluationSpeechEvent> NemoSpeechEngine::drain_speech_events() { return {}; }

void NemoSpeechEngine::reset() {
    if (stream_) {
        nemo_speech_asr_stream_close(stream_);
        stream_ = nullptr;
    }
    if (recognizer_) {
        nemo_speech_asr_destroy(recognizer_);
        recognizer_ = nullptr;
    }
}

[[noreturn]] void NemoSpeechEngine::throw_last_error(const char* operation) const {
    const char* error = nemo_speech_asr_last_error();
    throw std::runtime_error(std::string(operation) + " failed: " + (error ? error : "unknown error"));
}

} // namespace talk_to_pi::evaluation
