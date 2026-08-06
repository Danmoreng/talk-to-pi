#include "evaluation_engine.hpp"
#include "nemo_engine.hpp"
#include "parakeet_engine.hpp"
#include "pcm_source.hpp"

#include <nlohmann/json.hpp>

#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>
#include <sys/resource.h>

using talk_to_pi::evaluation::EvaluationEngine;
using talk_to_pi::evaluation::EvaluationEngineConfig;
using talk_to_pi::evaluation::EvaluationHypothesis;
using talk_to_pi::evaluation::EvaluationSpeechEvent;
using talk_to_pi::evaluation::NemoSpeechEngine;
using talk_to_pi::evaluation::ParakeetEngine;
using talk_to_pi::evaluation::PcmAudio;
using talk_to_pi::evaluation::load_wav;
using json = nlohmann::json;

namespace {
using Clock = std::chrono::steady_clock;

struct Options {
    std::string engine;
    std::string model;
    std::string audio;
    std::string language = "de-DE";
    std::string pace = "realtime";
    std::string run_id;
    int push_ms = 20;
    int right_context = 3;
    int threads = 0;
};

std::string next_run_id() {
    return std::to_string(Clock::now().time_since_epoch().count());
}

void usage() {
    std::cerr << "Usage: talk-to-pi-engine-eval --engine nemo|parakeet --model MODEL "
                 "--audio WAV [options]\n"
                 "  --language CODE       default de-DE\n"
                 "  --pace realtime|unpaced default realtime\n"
                 "  --push-ms N           default 20\n"
                 "  --right-context N     default 3\n"
                 "  --threads N           recorded requested policy\n"
                 "  --run-id ID           optional run identifier\n";
}

Options parse_options(int argc, char** argv) {
    Options options;
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        auto value = [&]() -> std::string {
            if (i + 1 >= argc) throw std::runtime_error("missing value for " + arg);
            return argv[++i];
        };
        if (arg == "--help" || arg == "-h") {
            usage();
            std::exit(0);
        } else if (arg == "--engine") options.engine = value();
        else if (arg == "--model") options.model = value();
        else if (arg == "--audio") options.audio = value();
        else if (arg == "--language") options.language = value();
        else if (arg == "--pace") options.pace = value();
        else if (arg == "--push-ms") options.push_ms = std::stoi(value());
        else if (arg == "--right-context") options.right_context = std::stoi(value());
        else if (arg == "--threads") options.threads = std::stoi(value());
        else if (arg == "--run-id") options.run_id = value();
        else throw std::runtime_error("unknown argument: " + arg);
    }
    if (options.engine != "nemo" && options.engine != "parakeet")
        throw std::runtime_error("--engine must be nemo or parakeet");
    if (options.model.empty() || options.audio.empty())
        throw std::runtime_error("--model and --audio are required");
    if (options.pace != "realtime" && options.pace != "unpaced")
        throw std::runtime_error("--pace must be realtime or unpaced");
    if (options.push_ms <= 0 || options.right_context < -1)
        throw std::runtime_error("invalid streaming configuration");
    if (options.run_id.empty()) options.run_id = next_run_id();
    return options;
}

class Runner {
public:
    explicit Runner(Options options) : options_(std::move(options)), start_(Clock::now()) {}

    int run() {
        emit({{"event", "process_started"}, {"pace", options_.pace},
              {"pushMs", options_.push_ms}, {"threads", options_.threads}});
        const PcmAudio audio = load_wav(options_.audio);
        emit({{"event", "audio_loaded"}, {"sampleRate", audio.sample_rate},
              {"samples", audio.samples.size()}, {"durationMs", audio.duration_ms()}});

        if (options_.engine == "nemo") engine_ = std::make_unique<NemoSpeechEngine>();
        else engine_ = std::make_unique<ParakeetEngine>();

        EvaluationEngineConfig config;
        config.model_path = options_.model;
        config.language = options_.language;
        config.sample_rate = audio.sample_rate;
        config.threads = options_.threads;
        config.right_context_frames = options_.right_context;

        emit({{"event", "model_load_started"}});
        const auto load_start = Clock::now();
        engine_->load(config);
        const double load_ms = elapsed_ms(load_start);
        emit({{"event", "model_loaded"}, {"modelLoadMs", load_ms},
              {"engineVersion", engine_->version()}});

        engine_->start_stream();
        const auto stream_start = Clock::now();
        emit({{"event", "stream_started"}, {"audioDurationMs", audio.duration_ms()}});

        const std::size_t chunk_size = static_cast<std::size_t>(options_.push_ms) * 16;
        std::size_t offset = 0;
        while (offset < audio.samples.size()) {
            const std::size_t count = std::min(chunk_size, audio.samples.size() - offset);
            if (options_.pace == "realtime") {
                const auto target = stream_start + std::chrono::milliseconds(
                    static_cast<long long>(offset * 1000.0 / audio.sample_rate));
                std::this_thread::sleep_until(target);
            }
            engine_->push_audio(audio.samples.data() + offset, count, audio.sample_rate);
            emit({{"event", "audio_chunk_pushed"}, {"offsetSamples", offset},
                  {"countSamples", count}, {"audioProcessedMs", (offset + count) * 1000.0 / audio.sample_rate}});
            emit_hypotheses(engine_->poll());
            emit_speech_events(engine_->drain_speech_events());
            offset += count;
        }

        emit({{"event", "finish_requested"}});
        const auto finish_start = Clock::now();
        std::vector<EvaluationHypothesis> final_hypotheses = engine_->finish();
        emit_hypotheses(final_hypotheses);
        emit_speech_events(engine_->drain_speech_events());
        if (!last_text_.has_value()) last_text_ = std::string();
        emit({{"event", "final_result"}, {"text", last_text_.value()},
              {"audioDurationMs", audio.duration_ms()}, {"finishLatencyMs", elapsed_ms(finish_start)}});
        engine_->reset();
        emit({{"event", "stream_closed"}});
        emit_metrics();
        emit({{"event", "process_exited"}, {"status", "success"}});
        return 0;
    }

private:
    double elapsed_ms(Clock::time_point from) const {
        return std::chrono::duration<double, std::milli>(Clock::now() - from).count();
    }

    void emit(json event) {
        event["schemaVersion"] = 1;
        event["runId"] = options_.run_id;
        event["engine"] = engine_ ? engine_->name() : options_.engine;
        event["emittedAtMs"] = elapsed_ms(start_);
        std::cout << event.dump() << '\n' << std::flush;
    }

    void emit_hypotheses(const std::vector<EvaluationHypothesis>& hypotheses) {
        for (const auto& hypothesis : hypotheses) {
            last_text_ = hypothesis.normalized_text;
            emit({{"event", "hypothesis"}, {"text", hypothesis.normalized_text},
                  {"rawText", hypothesis.raw_text}, {"final", hypothesis.is_final},
                  {"engineStable", hypothesis.is_engine_stable},
                  {"audioProcessedMs", hypothesis.audio_processed_ms}});
        }
    }

    void emit_speech_events(const std::vector<EvaluationSpeechEvent>& events) {
        for (const auto& event : events)
            emit({{"event", "speech_event"}, {"type", event.type}, {"timeSec", event.time_sec}});
    }

    void emit_metrics() {
        struct rusage usage{};
        getrusage(RUSAGE_SELF, &usage);
        const double user_ms = usage.ru_utime.tv_sec * 1000.0 + usage.ru_utime.tv_usec / 1000.0;
        const double system_ms = usage.ru_stime.tv_sec * 1000.0 + usage.ru_stime.tv_usec / 1000.0;
        emit({{"event", "process_metrics"}, {"userCpuMs", user_ms},
              {"systemCpuMs", system_ms}, {"peakRssBytes", usage.ru_maxrss * 1024LL}});
    }

    Options options_;
    std::unique_ptr<EvaluationEngine> engine_;
    Clock::time_point start_;
    std::optional<std::string> last_text_;
};

} // namespace

int main(int argc, char** argv) {
    std::optional<Options> options;
    try {
        options = parse_options(argc, argv);
        Runner runner(*options);
        return runner.run();
    } catch (const std::exception& error) {
        json event = {{"schemaVersion", 1}, {"event", "error"}, {"message", error.what()}};
        if (options) {
            event["runId"] = options->run_id;
            event["engine"] = options->engine;
        }
        std::cout << event.dump() << '\n' << std::flush;
        return 1;
    }
}
