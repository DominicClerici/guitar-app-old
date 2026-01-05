#include "NativeDSPModule.h"

#include <cmath>

namespace facebook::react {

NativeDSPModule::NativeDSPModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeDSPModuleCxxSpec(std::move(jsInvoker)), yinInstance(nullptr) {}

float NativeDSPModule::pitch(jsi::Runtime& rt, const std::vector<float>& input,
                             float sampleRate, float minFreq, float maxFreq,
                             float threshold) {
  // (re)initialize yinInstance
  if (!yinInstance || yinInstance->getBufferSize() != static_cast<int>(input.size()) ||
      sampleRate != yinInstance->getSampleRate()) {
    yinInstance = std::make_unique<Yin>(sampleRate, input.size());

    // Log on each initialization
    std::string message = string_format(
        "Creating YIN instance @%.2fHz | buffer size: %zu",
        yinInstance->getSampleRate(), input.size());
    log(rt, message);
  }

  auto pitchValue = yinInstance->getPitch(input, rt, minFreq, maxFreq, threshold);

  return pitchValue;
}

float NativeDSPModule::rms(jsi::Runtime& rt, const std::vector<float>& input) {
  double sumSquares = 0.0;
  for (float value : input) {
    sumSquares += value * value;
  }
  return static_cast<float>(std::sqrt(sumSquares / input.size()));
}

}  // namespace facebook::react
