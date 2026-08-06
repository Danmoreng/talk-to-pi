#include "runtime_controller.hpp"

#include <chrono>
#include <iostream>
#include <vector>

namespace talk_to_pi {

RuntimeController::RuntimeController(std::string model_path, Writer writer)
    : model_path_(std::move(model_path)), writer_(std::move(writer)) {}

RuntimeController::~RuntimeController() { shutdown(); }

void RuntimeController::emit_hello() {
    emit({
        {"v", kProtocolVersion},
        {"type", "hello"},
        {"runtimeVersion", "0.1.0"},
        {"protocolVersions", {kProtocolVersion}},
        {"nemoAbi", engine_.abi_version()},
        {"engine", "nemo-speech.cpp"},
        {"platform", TALK_TO_PI_ENABLE_CUDA ? "linux-x64-cuda" : "linux-x64-cpu"},
    });
}

bool RuntimeController::load_model() {
    emit({{"v", kProtocolVersion}, {"type", "loading_model"}});
    std::string error;
    if (!engine_.load(model_path_, error)) {
        startup_error_ = error;
        emit_error("MODEL_LOAD_FAILED", error, false);
        should_exit_ = true;
        state_ = State::Exited;
        return false;
    }
    state_ = State::Ready;
    emit({
        {"v", kProtocolVersion},
        {"type", "ready"},
        {"model", "nemotron-3.5-asr-streaming-0.6b-q8_0"},
        {"engine", "nemo-speech.cpp"},
    });
    return true;
}

void RuntimeController::handle(const Command& command) {
    if (command.type == "ping") {
        emit({{"v", kProtocolVersion}, {"type", "pong"}, {"id", command.id}});
        return;
    }
    if (command.type == "start") {
        start(command);
        return;
    }
    if (command.type == "stop") {
        stop(command, false);
        return;
    }
    if (command.type == "cancel") {
        stop(command, true);
        return;
    }
    if (command.type == "shutdown") {
        acknowledge(command);
        shutdown();
        return;
    }
    emit_error("UNKNOWN_COMMAND", "Unknown command type: " + command.type, true, command.id);
}

void RuntimeController::shutdown() {
    std::lock_guard<std::mutex> lock(state_mutex_);
    if (state_ == State::Exited) return;
    state_ = State::ShuttingDown;
    capture_.stop();
    join_worker();
    engine_.cancel();
    state_ = State::Exited;
    should_exit_ = true;
    emit({{"v", kProtocolVersion}, {"type", "shutdown_complete"}});
}

void RuntimeController::emit(nlohmann::json message) {
    std::lock_guard<std::mutex> lock(output_mutex_);
    message["seq"] = ++sequence_;
    writer_(message);
}

void RuntimeController::emit_error(const std::string& code, const std::string& message, bool recoverable,
                                    const std::optional<std::string>& id,
                                    const std::optional<std::string>& session_id) {
    emit(JsonlProtocol::error(0, code, message, recoverable, id, session_id));
}

void RuntimeController::acknowledge(const Command& command) {
    nlohmann::json message = {
        {"v", kProtocolVersion},
        {"type", "command_ack"},
        {"id", command.id},
        {"command", command.type},
    };
    if (command.session_id) message["sessionId"] = *command.session_id;
    emit(message);
}

void RuntimeController::start(const Command& command) {
    if (!command.session_id || !command.language) {
        emit_error("INVALID_COMMAND", "start requires sessionId and language", true, command.id);
        return;
    }
    std::lock_guard<std::mutex> lock(state_mutex_);
    if (state_ != State::Ready) {
        emit_error("INVALID_STATE", "start is only valid in ready state", true, command.id, command.session_id);
        return;
    }
    std::string error;
    if (!engine_.begin(*command.language, error)) {
        emit_error("TRANSCRIPTION_FAILED", error, true, command.id, command.session_id);
        return;
    }
    ring_.clear();
    transcript_.clear();
    session_id_ = *command.session_id;
    acknowledge(command);
    if (!capture_.start(error)) {
        engine_.cancel();
        session_id_.clear();
        emit_error("MICROPHONE_UNAVAILABLE", error, true, std::nullopt, command.session_id);
        return;
    }
    state_ = State::Recording;
    emit({
        {"v", kProtocolVersion},
        {"type", "recording_started"},
        {"sessionId", session_id_},
        {"language", *command.language},
        {"audioDevice", "Default"},
    });
    worker_ = std::thread(&RuntimeController::worker_loop, this, session_id_);
}

void RuntimeController::stop(const Command& command, bool cancelled) {
    if (!command.session_id) {
        emit_error("INVALID_COMMAND", "stop/cancel requires sessionId", true, command.id);
        return;
    }
    {
        std::lock_guard<std::mutex> lock(state_mutex_);
        if (state_ != State::Recording || session_id_ != *command.session_id) {
            emit_error("INVALID_STATE", "stop/cancel does not match the active recording", true, command.id, command.session_id);
            return;
        }
        state_ = State::Finalizing;
        capture_.stop();
    }
    acknowledge(command);
    join_worker();
    if (cancelled) {
        engine_.cancel();
        emit({{"v", kProtocolVersion}, {"type", "recording_cancelled"}, {"sessionId", *command.session_id}});
    } else {
        FeedResult result;
        std::string error;
        if (!engine_.finalize(result, error)) {
            emit_error("TRANSCRIPTION_FAILED", error, true, std::nullopt, command.session_id);
        } else {
            emit_feed(result, *command.session_id);
            emit({
                {"v", kProtocolVersion},
                {"type", "recording_finalized"},
                {"sessionId", *command.session_id},
                {"text", transcript_},
            });
        }
    }
    {
        std::lock_guard<std::mutex> lock(state_mutex_);
        session_id_.clear();
        state_ = State::Ready;
    }
}

void RuntimeController::worker_loop(std::string session_id) {
    std::vector<float> block(1600);
    while (capture_.running() || ring_.available() > 0) {
        const auto count = ring_.pop(block.data(), block.size());
        if (count == 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        }
        FeedResult result;
        std::string error;
        if (!engine_.feed(block.data(), static_cast<int>(count), result, error)) {
            emit_error("TRANSCRIPTION_FAILED", error, true, std::nullopt, session_id);
            capture_.stop();
            return;
        }
        emit_feed(result, session_id);
        if (ring_.dropped_samples() > 0) {
            emit_error("AUDIO_BUFFER_OVERFLOW", "Audio frames were dropped because inference fell behind.", true,
                       std::nullopt, session_id);
        }
    }
}

void RuntimeController::emit_feed(const FeedResult& result, const std::string& session_id) {
    if (result.cumulative_text) {
        transcript_ = result.text;
        emit({
            {"v", kProtocolVersion},
            {"type", "transcript_update"},
            {"sessionId", session_id},
            {"text", transcript_},
        });
    } else if (!result.text.empty()) {
        transcript_ += result.text;
        emit({
            {"v", kProtocolVersion},
            {"type", "transcript_delta"},
            {"sessionId", session_id},
            {"text", result.text},
        });
    }
    for (const auto& event : result.events) {
        emit({
            {"v", kProtocolVersion},
            {"type", "speech_event"},
            {"sessionId", session_id},
            {"event", event.type},
            {"timeSec", event.time_sec},
        });
    }
}

void RuntimeController::join_worker() {
    if (worker_.joinable()) worker_.join();
}

} // namespace talk_to_pi
