cmake_minimum_required(VERSION 3.24)
project(talk_to_pi_runtime VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(TALK_TO_PI_BUILD_TESTS "Build native protocol tests" ON)

set(PARAKEET_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(PARAKEET_BUILD_CLI OFF CACHE BOOL "" FORCE)
set(PARAKEET_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(PARAKEET_SHARED OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)

add_subdirectory(vendor/parakeet.cpp parakeet-build EXCLUDE_FROM_ALL)
target_include_directories(parakeet PRIVATE vendor/parakeet.cpp/third_party)

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
  vendor/parakeet.cpp/include
  vendor/miniaudio
)
target_link_libraries(talk-to-pi-runtime PRIVATE parakeet miniaudio Threads::Threads ${CMAKE_DL_LIBS} m)
if(TALK_TO_PI_BUILD_TESTS)
  enable_testing()
  add_executable(jsonl_protocol_test tests/jsonl_protocol_test.cpp src/jsonl_protocol.cpp)
  target_include_directories(jsonl_protocol_test PRIVATE include vendor/nlohmann-json/single_include)
  add_test(NAME jsonl_protocol_test COMMAND jsonl_protocol_test)
endif()
