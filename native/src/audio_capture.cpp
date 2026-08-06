#include "audio_capture.hpp"

#include <cstring>

namespace talk_to_pi {

AudioRingBuffer::AudioRingBuffer(std::size_t capacity_samples)
    : data_(capacity_samples + 1), capacity_(capacity_samples + 1) {}

std::size_t AudioRingBuffer::push(const float* samples, std::size_t count) {
    if (!samples || count == 0) return 0;
    std::size_t written = 0;
    auto write = write_index_.load(std::memory_order_relaxed);
    const auto read = read_index_.load(std::memory_order_acquire);
    while (written < count) {
        const auto next = (write + 1) % capacity_;
        if (next == read) {
            dropped_samples_.fetch_add(count - written, std::memory_order_relaxed);
            break;
        }
        data_[write] = samples[written++];
        write = next;
    }
    write_index_.store(write, std::memory_order_release);
    return written;
}

std::size_t AudioRingBuffer::pop(float* destination, std::size_t count) {
    if (!destination || count == 0) return 0;
    std::size_t read = read_index_.load(std::memory_order_relaxed);
    const auto write = write_index_.load(std::memory_order_acquire);
    std::size_t copied = 0;
    while (copied < count && read != write) {
        destination[copied++] = data_[read];
        read = (read + 1) % capacity_;
    }
    read_index_.store(read, std::memory_order_release);
    return copied;
}

void AudioRingBuffer::clear() {
    const auto write = write_index_.load(std::memory_order_acquire);
    read_index_.store(write, std::memory_order_release);
    dropped_samples_.store(0, std::memory_order_relaxed);
}

std::size_t AudioRingBuffer::available() const {
    const auto read = read_index_.load(std::memory_order_acquire);
    const auto write = write_index_.load(std::memory_order_acquire);
    return write >= read ? write - read : capacity_ - read + write;
}

AudioCapture::~AudioCapture() { stop(); }

bool AudioCapture::start(std::string& error) {
    if (running_) return true;

    auto config = ma_device_config_init(ma_device_type_capture);
    config.capture.format = ma_format_f32;
    config.capture.channels = 1;
    config.sampleRate = 16000;
    config.dataCallback = &AudioCapture::data_callback;
    config.pUserData = this;

    const auto result = ma_device_init(nullptr, &config, &device_);
    if (result != MA_SUCCESS) {
        error = "No default capture device could be opened (miniaudio error " + std::to_string(result) + ")";
        return false;
    }
    initialized_ = true;
    const auto start_result = ma_device_start(&device_);
    if (start_result != MA_SUCCESS) {
        error = "Capture device could not be started (miniaudio error " + std::to_string(start_result) + ")";
        ma_device_uninit(&device_);
        initialized_ = false;
        return false;
    }
    running_ = true;
    return true;
}

void AudioCapture::stop() {
    running_ = false;
    if (!initialized_) return;
    ma_device_stop(&device_);
    ma_device_uninit(&device_);
    initialized_ = false;
}

void AudioCapture::data_callback(ma_device* device, void*, const void* input,
                                 ma_uint32 frame_count) {
    auto* capture = static_cast<AudioCapture*>(device->pUserData);
    if (!capture || !input || !capture->running_) return;
    capture->ring_.push(static_cast<const float*>(input), frame_count);
}

} // namespace talk_to_pi
