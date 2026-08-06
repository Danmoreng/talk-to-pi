#include "jsonl_protocol.hpp"

#include <cassert>
#include <stdexcept>

int main() {
    const auto command = talk_to_pi::JsonlProtocol::parse_command(
        R"({"v":1,"type":"start","id":"r1","sessionId":"s1","language":"de-DE"})");
    assert(command.type == "start");
    assert(command.id == "r1");
    assert(command.session_id && *command.session_id == "s1");
    assert(command.language && *command.language == "de-DE");

    const auto encoded = talk_to_pi::JsonlProtocol::encode({{"v", 1}, {"type", "pong"}, {"seq", 1}});
    assert(encoded.back() == '\n');

    bool rejected = false;
    try {
        (void)talk_to_pi::JsonlProtocol::parse_command(R"({"v":2,"type":"ping","id":"r1"})");
    } catch (const std::exception&) {
        rejected = true;
    }
    assert(rejected);
    return 0;
}
