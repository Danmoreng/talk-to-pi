#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace talk_to_pi::evaluation {

struct EvaluationEngineConfig {
    std::string model_path;
    std::string language = "de-DE";
    int sample_rate = 16000;
    int threads = 0;
    int right_context_frames = 3;
};

struct EvaluationHypothesis {
    std::string raw_text;
    std::string normalized_text;
    bool is_final = false;
    bool is_engine_stable = false;
    double audio_processed_ms = 0.0;
};

struct EvaluationSpeechEvent {
    std::string type;
    double time_sec = 0.0;
};

class EvaluationEngine {
public:
    virtual ~EvaluationEngine() = default;

    virtual std::string name() const = 0;
    virtual std::string version() const = 0;
    virtual void load(const EvaluationEngineConfig& config) = 0;
    virtual void start_stream() = 0;
    virtual void push_audio(const float* samples, std::size_t count, int sample_rate) = 0;
    virtual std::vector<EvaluationHypothesis> poll() = 0;
    virtual std::vector<EvaluationHypothesis> finish() = 0;
    virtual std::vector<EvaluationSpeechEvent> drain_speech_events() = 0;
    virtual void reset() = 0;
};

std::string normalize_display_text(const std::string& raw);

} // namespace talk_to_pi::evaluation
