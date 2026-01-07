#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BitstreamAutoCorrelate : NSObject

/**
 * Detect pitch using Bitstream Autocorrelation algorithm.
 * @param buffer Audio buffer samples as float array
 * @param bufferSize Number of samples in buffer
 * @param sampleRate Sample rate in Hz
 * @param minVolume Minimum volume in decibels to trigger detection
 * @return Detected frequency in Hz, or -1 if no pitch detected
 */
+ (double)detectPitchFromBuffer:(const float *)buffer
                     bufferSize:(int)bufferSize
                     sampleRate:(double)sampleRate
                      minVolume:(double)minVolume;

@end

NS_ASSUME_NONNULL_END
