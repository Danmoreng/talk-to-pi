#pragma once

#include "evaluation_engine.hpp"
#include <parakeet_capi.h>

namespace talk_to_pi::evaluation {

class ParakeetEngine final : public EvaluationEngine {
public:
    ~ParakeetEngine() override;

    std::string name() const override { return "parakeet-cpp"; }
    std::string version() const override;
    void load(const EvaluationEngineConfig& config) override;
    void start_stream() override;
    void push_audio(const float* samples, std::size_t count, int sample_rate) override;
    std::vector<EvaluationHypothesis> poll() override;
    std::vector<EvaluationHypothesis> finish() override;
    std::vector<EvaluationSpeechEvent> drain_speech_events() override;
    void reset() override;

private:
    void feed(const float* samples, std::size_t count);
    void append_delta(const char* text, bool is_final);

    EvaluationEngineConfig config_;
    std::string language_;
    parakeet_ctx* context_ = nullptr;
    parakeet_stream* stream_ = nullptr;
    std::string cumulative_text_;
    double audio_processed_ms_ = 0.0;
    std::vector<EvaluationHypothesis> pending_;
};

} // namespace talk_to_pi::evaluation
