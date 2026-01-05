// Must define before any includes to prevent Folly coroutine detection
#define FOLLY_CFG_NO_COROUTINES 1

#import <Foundation/Foundation.h>
#import <ReactCommon/CxxTurboModuleUtils.h>

#include "NativeDSPModule.h"

@interface DSPModuleProvider : NSObject
@end

@implementation DSPModuleProvider

+ (void)load {
  facebook::react::registerCxxModuleToGlobalModuleMap(
      std::string{facebook::react::NativeDSPModuleCxxSpec<
          facebook::react::NativeDSPModule>::kModuleName},
      [](std::shared_ptr<facebook::react::CallInvoker> jsInvoker) {
        return std::make_shared<facebook::react::NativeDSPModule>(jsInvoker);
      });
}

@end
