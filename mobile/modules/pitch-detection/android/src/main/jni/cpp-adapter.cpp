#include <jni.h>
#include "AutoCorrelate.hpp"
#include "BitstreamAutoCorrelate.hpp"
#include <vector>

extern "C" JNIEXPORT jdouble JNICALL
Java_expo_modules_pitchdetection_PitchDetectionModule_nativeAutoCorrelate(
    JNIEnv *env,
    jobject thiz,
    jshortArray buffer,
    jint sampleRate,
    jdouble minVolume
) {
    jshort *buf = env->GetShortArrayElements(buffer, nullptr);
    jsize size = env->GetArrayLength(buffer);

    // Convert short buffer to double vector (normalize to -1.0 to 1.0 range)
    std::vector<double> vec(size);
    for (int i = 0; i < size; ++i) {
        vec[i] = static_cast<double>(buf[i]) / 32768.0;
    }

    env->ReleaseShortArrayElements(buffer, buf, 0);

    return pitchdetection::autoCorrelate(vec, static_cast<double>(sampleRate), minVolume);
}

extern "C" JNIEXPORT jdouble JNICALL
Java_expo_modules_pitchdetection_PitchDetectionModule_nativeBitstreamAutoCorrelate(
    JNIEnv *env,
    jobject thiz,
    jshortArray buffer,
    jint sampleRate,
    jdouble minVolume
) {
    jshort *buf = env->GetShortArrayElements(buffer, nullptr);
    jsize size = env->GetArrayLength(buffer);

    // Convert short buffer to double vector (normalize to -1.0 to 1.0 range)
    std::vector<double> vec(size);
    for (int i = 0; i < size; ++i) {
        vec[i] = static_cast<double>(buf[i]) / 32768.0;
    }

    env->ReleaseShortArrayElements(buffer, buf, 0);

    return pitchdetection::bitstreamAutoCorrelate(
        vec,
        static_cast<double>(sampleRate),
        minVolume
    );
}
