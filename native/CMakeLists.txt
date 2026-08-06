cmake_minimum_required(VERSION 3.26)
project(talk_to_pi_runtime VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(TALK_TO_PI_BUILD_TESTS "Build native protocol tests" ON)
option(TALK_TO_PI_ENABLE_CUDA "Enable the CUDA backend for local NVIDIA GPU builds" OFF)

set(NEMO_SPEECH_BUILD_ASR ON CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_DIAR OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_TTS OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_NMT OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_CLI OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_HTTP OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_GRPC OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(NEMO_SPEECH_CUBLAS_SHIM OFF CACHE BOOL "" FORCE)
set(GGML_CUDA ${TALK_TO_PI_ENABLE_CUDA} CACHE BOOL "" FORCE)

find_program(BASH_EXECUTABLE bash REQUIRED)
execute_process(
  COMMAND "${BASH_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/vendor/NeMo-Speech.cpp/scripts/apply-ggml-patches.sh"
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/vendor/NeMo-Speech.cpp"
  RESULT_VARIABLE NEMO_PATCH_RESULT
)
if(NEMO_PATCH_RESULT)
  message(FATAL_ERROR "NeMo-Speech.cpp ggml patch application failed: ${NEMO_PATCH_RESULT}")
endif()

add_subdirectory(vendor/NeMo-Speech.cpp nemo-speech-build EXCLUDE_FROM_ALL)

add_library(miniaudio STATIC vendor/miniaudio/miniaudio.c)
target_include_directories(miniaudio PUBLIC vendor/miniaudio)
set_target_properties(miniaudio PROPERTIES C_STANDARD 11 C_STANDARD_REQUIRED ON)

find_package(Threads REQUIRED)

add_executable(talk-to-pi-runtime
  src/audio_capture.cpp
  src/jsonl_protocol.cpp
  src/main.cpp
  src/runtime_controller.cpp
  src/transcription_engine.cpp
)
target_include_directories(talk-to-pi-runtime PRIVATE
  include
  vendor/nlohmann-json/single_include
  vendor/NeMo-Speech.cpp/include
  vendor/miniaudio
)
target_link_libraries(talk-to-pi-runtime PRIVATE nemo_speech_asr_c miniaudio Threads::Threads ${CMAKE_DL_LIBS} m)
target_compile_definitions(talk-to-pi-runtime PRIVATE
  TALK_TO_PI_ENABLE_CUDA=$<BOOL:${TALK_TO_PI_ENABLE_CUDA}>
)
if(TALK_TO_PI_BUILD_TESTS)
  enable_testing()
  add_executable(jsonl_protocol_test tests/jsonl_protocol_test.cpp src/jsonl_protocol.cpp)
  target_include_directories(jsonl_protocol_test PRIVATE include vendor/nlohmann-json/single_include)
  add_test(NAME jsonl_protocol_test COMMAND jsonl_protocol_test)
endif()
