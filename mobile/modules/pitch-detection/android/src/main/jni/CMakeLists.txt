cmake_minimum_required(VERSION 3.4.1)
project(PitchDetection)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 14)

add_library(pitchdetection SHARED
    ../../../../shared/AutoCorrelate.cpp
    ../../../../shared/BitstreamAutoCorrelate.cpp
    cpp-adapter.cpp
)

include_directories(
    ../../../../shared
)
