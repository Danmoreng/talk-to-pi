#pragma once

#include <memory>
#include <string>
#include <vector>

#include <parakeet_capi.h>

namespace talk_to_pi {

struct SpeechEvent {
    std::string type;
    float time_sec = 0.0F;
};

struct FeedResult {
    std::string text;
    int audio_samples = 0;
    std::vector<SpeechEvent> events;
};

class TranscriptionEngine {
public:
    TranscriptionEngine() = default;
    ~TranscriptionEngine();

    bool load(const std::string& model_path, std::string& error);
    bool begin(const std::string& language, std::string& error);
    bool feed(const float* samples, int count, FeedResult& result, std::string& error);
    bool finalize(FeedResult& result, std::string& error);
    void cancel();
    bool loaded() const { return context_ != nullptr; }
    int abi_version() const;

private:
    bool collect_events(FeedResult& result, std::string& error);

    parakeet_ctx* context_ = nullptr;
    parakeet_stream* stream_ = nullptr;
};

} // namespace talk_to_pi
