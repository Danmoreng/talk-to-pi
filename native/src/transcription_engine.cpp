#include "transcription_engine.hpp"

#include <utility>

namespace talk_to_pi {

TranscriptionEngine::~TranscriptionEngine() {
    cancel();
    parakeet_capi_free(context_);
}

bool TranscriptionEngine::load(const std::string& model_path, std::string& error) {
    context_ = parakeet_capi_load(model_path.c_str());
    if (context_) return true;
    error = "The ASR model could not be loaded.";
    return false;
}

bool TranscriptionEngine::begin(const std::string& language, std::string& error) {
    cancel();
    stream_ = parakeet_capi_stream_begin_lang(context_, language.c_str());
    if (stream_) return true;
    error = context_ ? parakeet_capi_last_error(context_) : "ASR model is not loaded.";
    return false;
}

bool TranscriptionEngine::feed(const float* samples, int count, FeedResult& result, std::string& error) {
    result = {};
    if (!stream_) {
        error = "Transcription stream is not active.";
        return false;
    }
    int event_mask = 0;
    char* text = parakeet_capi_stream_feed(stream_, samples, count, &event_mask);
    if (!text) {
        error = parakeet_capi_last_error(context_);
        return false;
    }
    result.text = text;
    result.audio_samples = count;
    parakeet_capi_free_string(text);
    if (!collect_events(result, error)) return false;
    return true;
}

bool TranscriptionEngine::finalize(FeedResult& result, std::string& error) {
    result = {};
    if (!stream_) {
        error = "Transcription stream is not active.";
        return false;
    }
    char* text = parakeet_capi_stream_finalize(stream_);
    if (!text) {
        error = parakeet_capi_last_error(context_);
        return false;
    }
    result.text = text;
    parakeet_capi_free_string(text);
    if (!collect_events(result, error)) return false;
    parakeet_capi_stream_free(stream_);
    stream_ = nullptr;
    return true;
}

void TranscriptionEngine::cancel() {
    if (stream_) parakeet_capi_stream_free(stream_);
    stream_ = nullptr;
}

int TranscriptionEngine::abi_version() const { return parakeet_capi_abi_version(); }

bool TranscriptionEngine::collect_events(FeedResult& result, std::string& error) {
    parakeet_stream_event* events = nullptr;
    const int count = parakeet_capi_stream_drain_events(stream_, &events);
    if (count < 0) {
        error = parakeet_capi_last_error(context_);
        return false;
    }
    for (int index = 0; index < count; ++index) {
        result.events.push_back({events[index].is_eob ? "eob" : "eou", events[index].time_sec});
    }
    parakeet_capi_free_events(events);
    return true;
}

} // namespace talk_to_pi
