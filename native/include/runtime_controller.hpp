#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <mutex>
#include <string>
#include <thread>

#include "audio_capture.hpp"
#include "jsonl_protocol.hpp"
#include "transcription_engine.hpp"

namespace talk_to_pi {

class RuntimeController {
public:
    using Writer = std::function<void(const nlohmann::json&)>;

    RuntimeController(std::string model_path, Writer writer);
    ~RuntimeController();

    void emit_hello();
    bool load_model();
    void handle(const Command& command);
    void shutdown();
    bool should_exit() const { return should_exit_; }
    const std::string& startup_error() const { return startup_error_; }

private:
    enum class State { Loading, Ready, Recording, Finalizing, ShuttingDown, Exited };

    void emit(nlohmann::json message);
    void emit_error(const std::string& code, const std::string& message, bool recoverable,
                    const std::optional<std::string>& id = std::nullopt,
                    const std::optional<std::string>& session_id = std::nullopt);
    void acknowledge(const Command& command);
    void start(const Command& command);
    void stop(const Command& command, bool cancelled);
    void worker_loop(std::string session_id);
    void emit_feed(const FeedResult& result, const std::string& session_id);
    void join_worker();

    std::string model_path_;
    Writer writer_;
    std::atomic<bool> should_exit_{false};
    std::uint64_t sequence_ = 0;
    std::mutex output_mutex_;
    std::string transcript_;
    State state_ = State::Loading;
    std::string session_id_;
    std::string startup_error_;
    std::mutex state_mutex_;
    std::thread worker_;
    AudioRingBuffer ring_{16000 * 10};
    AudioCapture capture_{ring_};
    TranscriptionEngine engine_;
};

} // namespace talk_to_pi
