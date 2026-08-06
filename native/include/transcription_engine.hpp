#pragma once

#include <memory>
#include <string>
#include <vector>

#include <nemo_speech/asr.h>

namespace talk_to_pi {

struct SpeechEvent {
    std::string type;
    float time_sec = 0.0F;
};

struct FeedResult {
    std::string text;
    int audio_samples = 0;
    bool cumulative_text = false;
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
    bool loaded() const { return recognizer_ != nullptr; }
    int abi_version() const { return 1; }

private:
    bool collect_results(FeedResult& result, std::string& error);
    bool check(nemo_speech_asr_status status, const char* operation, std::string& error) const;

    nemo_speech_asr_recognizer* recognizer_ = nullptr;
    nemo_speech_asr_stream* stream_ = nullptr;
    nemo_speech_asr_recognition_options options_{};
    std::string language_;
    std::string cumulative_text_;
};

} // namespace talk_to_pi
