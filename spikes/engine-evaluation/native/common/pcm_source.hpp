#pragma once

#include <string>
#include <vector>

namespace talk_to_pi::evaluation {

struct PcmAudio {
    std::vector<float> samples;
    int sample_rate = 16000;

    double duration_ms() const {
        return sample_rate > 0 ? samples.size() * 1000.0 / sample_rate : 0.0;
    }
};

PcmAudio load_wav(const std::string& path);

} // namespace talk_to_pi::evaluation
