#pragma once

#include "evaluation_engine.hpp"
#include <nemo_speech/asr.h>

namespace talk_to_pi::evaluation {

class NemoSpeechEngine final : public EvaluationEngine {
public:
    ~NemoSpeechEngine() override;

    std::string name() const override { return "nemo-speech-cpp"; }
    std::string version() const override;
    void load(const EvaluationEngineConfig& config) override;
    void start_stream() override;
    void push_audio(const float* samples, std::size_t count, int sample_rate) override;
    std::vector<EvaluationHypothesis> poll() override;
    std::vector<EvaluationHypothesis> finish() override;
    std::vector<EvaluationSpeechEvent> drain_speech_events() override;
    void reset() override;

private:
    std::vector<EvaluationHypothesis> drain_results();
    [[noreturn]] void throw_last_error(const char* operation) const;

    EvaluationEngineConfig config_;
    std::string language_;
    nemo_speech_asr_recognizer* recognizer_ = nullptr;
    nemo_speech_asr_stream* stream_ = nullptr;
    nemo_speech_asr_recognition_options options_{};
};

} // namespace talk_to_pi::evaluation
