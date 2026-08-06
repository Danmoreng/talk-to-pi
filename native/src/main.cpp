#include "jsonl_protocol.hpp"
#include "runtime_controller.hpp"

#include <iostream>
#include <string>

int main(int argc, char** argv) {
    std::string model_path;
    bool stdio = false;
    int protocol_version = 1;

    for (int index = 1; index < argc; ++index) {
        const std::string argument = argv[index];
        if (argument == "--stdio") {
            stdio = true;
        } else if (argument == "--model" && index + 1 < argc) {
            model_path = argv[++index];
        } else if (argument == "--protocol-version" && index + 1 < argc) {
            protocol_version = std::stoi(argv[++index]);
        } else if (argument == "--version") {
            std::cout << "talk-to-pi-runtime 0.1.0\n";
            return 0;
        }
    }

    if (!stdio || model_path.empty() || protocol_version != talk_to_pi::kProtocolVersion) {
        std::cerr << "Usage: talk-to-pi-runtime --stdio --model MODEL.gguf --protocol-version 1\n";
        return 2;
    }

    talk_to_pi::RuntimeController controller(model_path, [](const nlohmann::json& message) {
        std::cout << talk_to_pi::JsonlProtocol::encode(message) << std::flush;
    });
    controller.emit_hello();
    if (!controller.load_model()) return 1;

    std::string line;
    while (!controller.should_exit() && std::getline(std::cin, line)) {
        try {
            controller.handle(talk_to_pi::JsonlProtocol::parse_command(line));
        } catch (const std::exception& error) {
            std::cerr << "protocol error: " << error.what() << '\n';
            const nlohmann::json message = talk_to_pi::JsonlProtocol::error(
                0, "MALFORMED_COMMAND", error.what(), true);
            std::cout << talk_to_pi::JsonlProtocol::encode(message) << std::flush;
        }
    }
    controller.shutdown();
    return 0;
}
