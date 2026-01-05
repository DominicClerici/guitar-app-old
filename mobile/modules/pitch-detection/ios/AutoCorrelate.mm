#import "AutoCorrelate.h"
#import "AutoCorrelate.hpp"
#include <vector>

@implementation AutoCorrelate

+ (double)detectPitchFromBuffer:(const float *)buffer
                     bufferSize:(int)bufferSize
                     sampleRate:(double)sampleRate
                      minVolume:(double)minVolume {
    // Convert float buffer to double vector
    std::vector<double> buf(bufferSize);
    for (int i = 0; i < bufferSize; ++i) {
        buf[i] = static_cast<double>(buffer[i]);
    }

    return pitchdetection::autoCorrelate(buf, sampleRate, minVolume);
}

@end
