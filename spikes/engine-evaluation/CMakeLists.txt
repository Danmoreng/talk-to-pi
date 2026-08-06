cmake_minimum_required(VERSION 3.24)
project(talk_to_pi_engine_evaluation LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(NEMO_SPEECH_BUILD_DIR
    "${CMAKE_CURRENT_SOURCE_DIR}/third_party/NeMo-Speech.cpp/build/cpu-asr"
    CACHE PATH "Existing NeMo-Speech.cpp cpu-asr build directory")
set(NEMO_SPEECH_BIN_DIR "${NEMO_SPEECH_BUILD_DIR}/bin")
set(NEMO_SPEECH_CAPI "${NEMO_SPEECH_BIN_DIR}/libnemo_speech_asr_c.so")
if(NOT EXISTS "${NEMO_SPEECH_CAPI}")
    message(FATAL_ERROR
        "NeMo-Speech.cpp CPU build not found at ${NEMO_SPEECH_CAPI}. "
        "Run third_party/NeMo-Speech.cpp/scripts/configure.sh cpu-asr "
        "and cmake --build --preset cpu-asr first.")
endif()

set(PARAKEET_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(PARAKEET_BUILD_CLI OFF CACHE BOOL "" FORCE)
set(PARAKEET_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(PARAKEET_SHARED OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
add_subdirectory(../../native/vendor/parakeet.cpp parakeet-build EXCLUDE_FROM_ALL)
target_include_directories(parakeet PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../../native/vendor/parakeet.cpp/third_party
)

add_library(nemo_speech_asr_c SHARED IMPORTED GLOBAL)
set_target_properties(nemo_speech_asr_c PROPERTIES
    IMPORTED_LOCATION "${NEMO_SPEECH_CAPI}"
    INTERFACE_INCLUDE_DIRECTORIES "${CMAKE_CURRENT_SOURCE_DIR}/third_party/NeMo-Speech.cpp/include"
)

add_executable(talk-to-pi-engine-eval
    native/common/evaluation_engine.cpp
    native/common/pcm_source.cpp
    native/nemo_speech/nemo_engine.cpp
    native/parakeet/parakeet_engine.cpp
    native/runner/main.cpp
)
target_include_directories(talk-to-pi-engine-eval PRIVATE
    native/common
    native/nemo_speech
    native/parakeet
    ../../native/vendor/nlohmann-json/single_include
    ../../native/vendor/parakeet.cpp/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/NeMo-Speech.cpp/include
)
target_link_libraries(talk-to-pi-engine-eval PRIVATE
    parakeet
    nemo_speech_asr_c
)
set_target_properties(talk-to-pi-engine-eval PROPERTIES
    BUILD_RPATH "${NEMO_SPEECH_BIN_DIR}"
    INSTALL_RPATH "${NEMO_SPEECH_BIN_DIR}"
)

include(CTest)
if(BUILD_TESTING)
    add_test(NAME evaluation_runner_help COMMAND talk-to-pi-engine-eval --help)
endif()
