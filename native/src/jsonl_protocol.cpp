#include "jsonl_protocol.hpp"

#include <stdexcept>

namespace talk_to_pi {

namespace {

const std::string& required_string(const nlohmann::json& object, const char* key) {
    if (!object.contains(key) || !object.at(key).is_string()) {
        throw std::runtime_error(std::string("Missing string field: ") + key);
    }
    return object.at(key).get_ref<const std::string&>();
}

} // namespace

Command JsonlProtocol::parse_command(const std::string& line) {
    if (line.size() > kMaxLineBytes) throw std::runtime_error("Protocol line exceeds 1 MiB");

    const auto object = nlohmann::json::parse(line);
    if (!object.is_object()) throw std::runtime_error("Protocol message must be an object");
    if (!object.contains("v") || object.at("v") != kProtocolVersion) {
        throw std::runtime_error("Unsupported protocol version");
    }

    Command command;
    command.type = required_string(object, "type");
    command.id = required_string(object, "id");

    if (object.contains("sessionId")) command.session_id = required_string(object, "sessionId");
    if (object.contains("language")) command.language = required_string(object, "language");
    return command;
}

std::string JsonlProtocol::encode(const nlohmann::json& message) {
    const std::string line = message.dump();
    if (line.size() > kMaxLineBytes) throw std::runtime_error("Protocol message exceeds 1 MiB");
    return line + '\n';
}

nlohmann::json JsonlProtocol::error(std::uint64_t seq, const std::string& code,
                                    const std::string& message, bool recoverable,
                                    const std::optional<std::string>& id,
                                    const std::optional<std::string>& session_id) {
    nlohmann::json result = {
        {"v", kProtocolVersion},
        {"type", "error"},
        {"seq", seq},
        {"code", code},
        {"message", message},
        {"recoverable", recoverable},
    };
    if (id) result["id"] = *id;
    if (session_id) result["sessionId"] = *session_id;
    return result;
}

} // namespace talk_to_pi
