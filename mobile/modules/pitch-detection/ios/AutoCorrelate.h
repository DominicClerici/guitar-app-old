#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AutoCorrelate : NSObject

/**
 * Detect pitch using autocorrelation algorithm.
 * @param buffer Audio buffer samples as NSArray of NSNumber (floats)
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
