Pod::Spec.new do |s|
  s.name           = 'MicrophoneStream'
  s.version        = '1.0.0'
  s.summary        = 'Microphone audio streaming for pitch detection'
  s.description    = 'Streams raw audio samples from the microphone'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
