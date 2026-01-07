#import "BitstreamAutoCorrelate.h"
#import "BitstreamAutoCorrelate.hpp"
#include <vector>

@implementation BitstreamAutoCorrelate

+ (double)detectPitchFromBuffer:(const float *)buffer
                     bufferSize:(int)bufferSize
                     sampleRate:(double)sampleRate
                      minVolume:(double)minVolume {
    // Convert float buffer to double vector
    std::vector<double> buf(bufferSize);
    for (int i = 0; i < bufferSize; ++i) {
        buf[i] = static_cast<double>(buffer[i]);
    }

    return pitchdetection::bitstreamAutoCorrelate(buf, sampleRate, minVolume);
}

@end
