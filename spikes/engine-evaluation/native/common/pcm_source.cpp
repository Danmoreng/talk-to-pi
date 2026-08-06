#include "pcm_source.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <stdexcept>

namespace talk_to_pi::evaluation {
namespace {

std::uint16_t u16(const std::vector<std::uint8_t>& bytes, std::size_t offset) {
    if (offset + 2 > bytes.size()) throw std::runtime_error("truncated WAV metadata");
    return static_cast<std::uint16_t>(bytes[offset] | (bytes[offset + 1] << 8));
}

std::uint32_t u32(const std::vector<std::uint8_t>& bytes, std::size_t offset) {
    if (offset + 4 > bytes.size()) throw std::runtime_error("truncated WAV metadata");
    return static_cast<std::uint32_t>(bytes[offset] | (bytes[offset + 1] << 8) |
                                      (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24));
}

float sample_at(const std::uint8_t* data, std::size_t offset, std::uint16_t format,
                std::uint16_t bits) {
    if (format == 1 && bits == 16) {
        std::int16_t value = 0;
        std::memcpy(&value, data + offset, sizeof(value));
        return static_cast<float>(value) / 32768.0f;
    }
    if (format == 1 && bits == 32) {
        std::int32_t value = 0;
        std::memcpy(&value, data + offset, sizeof(value));
        return static_cast<float>(value) / 2147483648.0f;
    }
    if (format == 3 && bits == 32) {
        float value = 0.0f;
        std::memcpy(&value, data + offset, sizeof(value));
        return std::clamp(value, -1.0f, 1.0f);
    }
    throw std::runtime_error("unsupported WAV format; expected PCM16, PCM32, or float32");
}

} // namespace

PcmAudio load_wav(const std::string& path) {
    std::ifstream input(path, std::ios::binary);
    if (!input) throw std::runtime_error("cannot open WAV: " + path);
    input.seekg(0, std::ios::end);
    const auto size = input.tellg();
    if (size < 12) throw std::runtime_error("WAV is too small: " + path);
    input.seekg(0, std::ios::beg);
    std::vector<std::uint8_t> bytes(static_cast<std::size_t>(size));
    input.read(reinterpret_cast<char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    if (std::memcmp(bytes.data(), "RIFF", 4) != 0 || std::memcmp(bytes.data() + 8, "WAVE", 4) != 0)
        throw std::runtime_error("not a RIFF/WAVE file: " + path);

    std::uint16_t format = 0;
    std::uint16_t channels = 0;
    std::uint32_t sample_rate = 0;
    std::uint16_t bits = 0;
    const std::uint8_t* data = nullptr;
    std::size_t data_size = 0;
    std::size_t cursor = 12;
    while (cursor + 8 <= bytes.size()) {
        const std::uint32_t chunk_size = u32(bytes, cursor + 4);
        const std::size_t chunk_start = cursor + 8;
        if (chunk_start > bytes.size() || chunk_size > bytes.size() - chunk_start)
            throw std::runtime_error("truncated WAV chunk: " + path);
        if (std::memcmp(bytes.data() + cursor, "fmt ", 4) == 0 && chunk_size >= 16) {
            format = u16(bytes, chunk_start);
            channels = u16(bytes, chunk_start + 2);
            sample_rate = u32(bytes, chunk_start + 4);
            bits = u16(bytes, chunk_start + 14);
        } else if (std::memcmp(bytes.data() + cursor, "data", 4) == 0) {
            data = bytes.data() + chunk_start;
            data_size = chunk_size;
        }
        cursor = chunk_start + chunk_size + (chunk_size & 1U);
    }
    if (!data || !format || !channels || !sample_rate || !bits)
        throw std::runtime_error("WAV lacks required fmt/data chunks: " + path);
    if ((format != 1 && format != 3) || (bits != 16 && bits != 32))
        throw std::runtime_error("unsupported WAV encoding: " + path);
    if (data_size % (channels * (bits / 8)) != 0)
        throw std::runtime_error("WAV data is not frame-aligned: " + path);

    const std::size_t bytes_per_sample = bits / 8;
    const std::size_t bytes_per_frame = channels * bytes_per_sample;
    const std::size_t frames = data_size / bytes_per_frame;
    std::vector<float> mono(frames, 0.0f);
    for (std::size_t frame = 0; frame < frames; ++frame) {
        float sum = 0.0f;
        for (std::uint16_t channel = 0; channel < channels; ++channel)
            sum += sample_at(data, frame * bytes_per_frame + channel * bytes_per_sample, format, bits);
        mono[frame] = sum / static_cast<float>(channels);
    }

    PcmAudio audio;
    audio.sample_rate = static_cast<int>(sample_rate);
    audio.samples = std::move(mono);
    if (audio.sample_rate == 16000) return audio;

    const std::size_t output_frames = static_cast<std::size_t>(
        std::llround(audio.samples.size() * 16000.0 / audio.sample_rate));
    std::vector<float> resampled(output_frames);
    for (std::size_t i = 0; i < output_frames; ++i) {
        const double source = i * static_cast<double>(audio.sample_rate) / 16000.0;
        const auto left = static_cast<std::size_t>(source);
        const auto right = std::min(left + 1, audio.samples.size() - 1);
        const float fraction = static_cast<float>(source - left);
        resampled[i] = audio.samples[left] * (1.0f - fraction) + audio.samples[right] * fraction;
    }
    audio.samples = std::move(resampled);
    audio.sample_rate = 16000;
    return audio;
}

} // namespace talk_to_pi::evaluation
