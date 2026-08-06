#pragma once

#include <cstdint>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace talk_to_pi {

constexpr int kProtocolVersion = 1;
constexpr std::size_t kMaxLineBytes = 1024 * 1024;

struct Command {
    std::string type;
    std::string id;
    std::optional<std::string> session_id;
    std::optional<std::string> language;
};

class JsonlProtocol {
public:
    static Command parse_command(const std::string& line);
    static std::string encode(const nlohmann::json& message);
    static nlohmann::json error(std::uint64_t seq, const std::string& code,
                                const std::string& message, bool recoverable,
                                const std::optional<std::string>& id = std::nullopt,
                                const std::optional<std::string>& session_id = std::nullopt);
};

} // namespace talk_to_pi
