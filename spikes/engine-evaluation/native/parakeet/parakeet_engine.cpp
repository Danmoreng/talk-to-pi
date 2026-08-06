#include "parakeet_engine.hpp"

#include <stdexcept>

namespace talk_to_pi::evaluation {

ParakeetEngine::~ParakeetEngine() { reset(); }

std::string ParakeetEngine::version() const {
    return "capi-abi-" + std::to_string(parakeet_capi_abi_version());
}

void ParakeetEngine::load(const EvaluationEngineConfig& config) {
    reset();
    config_ = config;
    language_ = config.language;
    context_ = parakeet_capi_load(config_.model_path.c_str());
    if (!context_) throw std::runtime_error("parakeet_capi_load failed");
}

void ParakeetEngine::start_stream() {
    if (!context_) throw std::runtime_error("parakeet engine is not loaded");
    stream_ = parakeet_capi_stream_begin_lang(context_, language_.c_str());
    if (!stream_) {
        const char* error = parakeet_capi_last_error(context_);
        throw std::runtime_error(std::string("parakeet_capi_stream_begin_lang failed: ") +
                                 (error ? error : "unknown error"));
    }
    cumulative_text_.clear();
    pending_.clear();
    audio_processed_ms_ = 0.0;
}

void ParakeetEngine::push_audio(const float* samples, std::size_t count, int sample_rate) {
    if (sample_rate != 16000)
        throw std::runtime_error("parakeet evaluation runner requires 16 kHz PCM");
    feed(samples, count);
    audio_processed_ms_ += count * 1000.0 / sample_rate;
}

void ParakeetEngine::feed(const float* samples, std::size_t count) {
    if (!stream_) throw std::runtime_error("parakeet stream is not active");
    int event_mask = 0;
    char* text = parakeet_capi_stream_feed(stream_, samples, static_cast<int>(count), &event_mask);
    if (!text) {
        const char* error = parakeet_capi_last_error(context_);
        throw std::runtime_error(std::string("parakeet_capi_stream_feed failed: ") +
                                 (error ? error : "unknown error"));
    }
    append_delta(text, false);
    parakeet_capi_free_string(text);
}

std::vector<EvaluationHypothesis> ParakeetEngine::poll() {
    std::vector<EvaluationHypothesis> result;
    result.swap(pending_);
    return result;
}

std::vector<EvaluationHypothesis> ParakeetEngine::finish() {
    if (!stream_) return {};
    char* text = parakeet_capi_stream_finalize(stream_);
    if (!text) {
        const char* error = parakeet_capi_last_error(context_);
        throw std::runtime_error(std::string("parakeet_capi_stream_finalize failed: ") +
                                 (error ? error : "unknown error"));
    }
    append_delta(text, true);
    parakeet_capi_free_string(text);
    std::vector<EvaluationHypothesis> result;
    result.swap(pending_);
    return result;
}

void ParakeetEngine::append_delta(const char* text, bool is_final) {
    if (!text || !*text) return;
    cumulative_text_ += text;
    EvaluationHypothesis hypothesis;
    hypothesis.raw_text = cumulative_text_;
    hypothesis.normalized_text = normalize_display_text(hypothesis.raw_text);
    hypothesis.is_final = is_final;
    hypothesis.is_engine_stable = true;
    hypothesis.audio_processed_ms = audio_processed_ms_;
    pending_.push_back(std::move(hypothesis));
}

std::vector<EvaluationSpeechEvent> ParakeetEngine::drain_speech_events() {
    std::vector<EvaluationSpeechEvent> result;
    if (!stream_) return result;
    parakeet_stream_event* events = nullptr;
    const int count = parakeet_capi_stream_drain_events(stream_, &events);
    if (count < 0) {
        const char* error = parakeet_capi_last_error(context_);
        throw std::runtime_error(std::string("parakeet_capi_stream_drain_events failed: ") +
                                 (error ? error : "unknown error"));
    }
    for (int i = 0; i < count; ++i)
        result.push_back({events[i].is_eob ? "eob" : "eou", events[i].time_sec});
    parakeet_capi_free_events(events);
    return result;
}

void ParakeetEngine::reset() {
    if (stream_) {
        parakeet_capi_stream_free(stream_);
        stream_ = nullptr;
    }
    if (context_) {
        parakeet_capi_free(context_);
        context_ = nullptr;
    }
    pending_.clear();
    cumulative_text_.clear();
}

} // namespace talk_to_pi::evaluation
