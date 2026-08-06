#include "evaluation_engine.hpp"

#include <cctype>

namespace talk_to_pi::evaluation {

std::string normalize_display_text(const std::string& raw) {
    std::string output;
    output.reserve(raw.size());
    for (std::size_t i = 0; i < raw.size();) {
        if (raw[i] == '<') {
            const std::size_t end = raw.find('>', i + 1);
            if (end != std::string::npos && end > i + 1) {
                bool tag = true;
                for (std::size_t j = i + 1; j < end; ++j) {
                    const unsigned char c = static_cast<unsigned char>(raw[j]);
                    if (!(std::isalnum(c) || c == '-' || c == '_' || c == ':')) {
                        tag = false;
                        break;
                    }
                }
                if (tag) {
                    i = end + 1;
                    if (i < raw.size() && raw[i] == ' ') ++i;
                    continue;
                }
            }
        }
        output.push_back(raw[i++]);
    }
    return output;
}

} // namespace talk_to_pi::evaluation
