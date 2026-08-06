cmake_minimum_required(VERSION 3.26)
project(talk_to_pi_runtime VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(TALK_TO_PI_BUILD_TESTS "Build native protocol tests" ON)
option(TALK_TO_PI_ENABLE_CUDA "Enable the CUDA backend for local NVIDIA GPU builds" OFF)

# Release builds target a reproducible modern CPU baseline instead of the build
# host. x86_64 requires AVX2/FMA/F16C/BMI2; ARM64 uses ggml's portable ARM path.
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(GGML_SSE42 ON CACHE BOOL "" FORCE)
set(GGML_AVX ON CACHE BOOL "" FORCE)
set(GGML_AVX2 ON CACHE BOOL "" FORCE)
set(GGML_FMA ON CACHE BOOL "" FORCE)
set(GGML_F16C ON CACHE BOOL "" FORCE)
set(GGML_BMI2 ON CACHE BOOL "" FORCE)
set(GGML_AVX512 OFF CACHE BOOL "" FORCE)
set(GGML_AVX512_VBMI OFF CACHE BOOL "" FORCE)
set(GGML_AVX512_VNNI OFF CACHE BOOL "" FORCE)
set(GGML_AVX512_BF16 OFF CACHE BOOL "" FORCE)
if(MSVC)
  set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()

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

if(WIN32)
  set(TALK_TO_PI_SYSTEM "win32")
elseif(APPLE)
  set(TALK_TO_PI_SYSTEM "darwin")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  set(TALK_TO_PI_SYSTEM "linux")
else()
  message(FATAL_ERROR "Unsupported Talk-to-Pi operating system: ${CMAKE_SYSTEM_NAME}")
endif()
string(TOLOWER "${CMAKE_SYSTEM_PROCESSOR}" TALK_TO_PI_PROCESSOR)
if(TALK_TO_PI_PROCESSOR MATCHES "^(x86_64|amd64|x64)$")
  set(TALK_TO_PI_ARCH "x64")
elseif(TALK_TO_PI_PROCESSOR MATCHES "^(aarch64|arm64)$")
  set(TALK_TO_PI_ARCH "arm64")
else()
  message(FATAL_ERROR "Unsupported Talk-to-Pi CPU architecture: ${CMAKE_SYSTEM_PROCESSOR}")
endif()
if(TALK_TO_PI_ENABLE_CUDA)
  set(TALK_TO_PI_BACKEND "cuda")
else()
  set(TALK_TO_PI_BACKEND "cpu")
endif()
set(TALK_TO_PI_PLATFORM_KEY "${TALK_TO_PI_SYSTEM}-${TALK_TO_PI_ARCH}-${TALK_TO_PI_BACKEND}")

find_program(BASH_EXECUTABLE bash REQUIRED)
execute_process(
  COMMAND "${BASH_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/../scripts/apply-nemo-embed-patch.sh"
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  RESULT_VARIABLE NEMO_EMBED_PATCH_RESULT
)
if(NEMO_EMBED_PATCH_RESULT)
  message(FATAL_ERROR "NeMo-Speech.cpp embedding patch failed: ${NEMO_EMBED_PATCH_RESULT}")
endif()
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
target_link_libraries(talk-to-pi-runtime PRIVATE
  nemo_speech_asr_c
  miniaudio
  Threads::Threads
  ${CMAKE_DL_LIBS}
)
if(UNIX)
  target_link_libraries(talk-to-pi-runtime PRIVATE m)
endif()
target_compile_definitions(talk-to-pi-runtime PRIVATE
  TALK_TO_PI_ENABLE_CUDA=$<BOOL:${TALK_TO_PI_ENABLE_CUDA}>
  TALK_TO_PI_PLATFORM_KEY="${TALK_TO_PI_PLATFORM_KEY}"
  TALK_TO_PI_RUNTIME_VERSION="${PROJECT_VERSION}"
)
if(APPLE)
  set_target_properties(talk-to-pi-runtime PROPERTIES
    BUILD_RPATH "@loader_path/bin"
    INSTALL_RPATH "@executable_path/lib"
  )
elseif(UNIX)
  set_target_properties(talk-to-pi-runtime PROPERTIES
    BUILD_RPATH "$ORIGIN/bin"
    INSTALL_RPATH "$ORIGIN/lib"
  )
endif()
install(TARGETS talk-to-pi-runtime RUNTIME DESTINATION .)
install(TARGETS
  nemo_speech_asr_c
  nemo_speech_asr
  ggml
  ggml-base
  ggml-cpu
  RUNTIME DESTINATION lib
  LIBRARY DESTINATION lib
)
if(TARGET ggml-blas)
  install(TARGETS ggml-blas RUNTIME DESTINATION lib LIBRARY DESTINATION lib)
endif()
install(DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../licenses/" DESTINATION licenses)
if(TALK_TO_PI_BUILD_TESTS)
  enable_testing()
  add_executable(jsonl_protocol_test tests/jsonl_protocol_test.cpp src/jsonl_protocol.cpp)
  target_include_directories(jsonl_protocol_test PRIVATE include vendor/nlohmann-json/single_include)
  add_test(NAME jsonl_protocol_test COMMAND jsonl_protocol_test)
endif()
