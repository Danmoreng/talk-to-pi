#pragma once

#include <atomic>
#include <cstddef>
#include <string>
#include <vector>

#include <miniaudio.h>

namespace talk_to_pi {

class AudioRingBuffer {
public:
    explicit AudioRingBuffer(std::size_t capacity_samples);

    std::size_t push(const float* samples, std::size_t count);
    std::size_t pop(float* destination, std::size_t count);
    void clear();
    std::size_t available() const;
    std::size_t dropped_samples() const { return dropped_samples_.load(); }

private:
    std::vector<float> data_;
    const std::size_t capacity_;
    std::atomic<std::size_t> read_index_{0};
    std::atomic<std::size_t> write_index_{0};
    std::atomic<std::size_t> dropped_samples_{0};
};

class AudioCapture {
public:
    explicit AudioCapture(AudioRingBuffer& ring) : ring_(ring) {}
    ~AudioCapture();

    bool start(std::string& error);
    void stop();
    bool running() const { return running_; }

private:
    static void data_callback(ma_device* device, void* output, const void* input,
                              ma_uint32 frame_count);

    AudioRingBuffer& ring_;
    ma_device device_{};
    bool initialized_ = false;
    std::atomic<bool> running_{false};
};

} // namespace talk_to_pi
