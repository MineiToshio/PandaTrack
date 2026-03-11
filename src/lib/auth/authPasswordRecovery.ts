type PasswordRecoveryRequestContext = {
  email: string;
  request?: Request;
  token: string;
  url: string;
};

type PasswordRecoveryThrottleResult = {
  allowed: boolean;
};

export async function evaluatePasswordRecoveryThrottle(): Promise<PasswordRecoveryThrottleResult> {
  return { allowed: true };
}

export async function handlePasswordRecoveryRequest({
  email,
  request,
  token,
  url,
}: PasswordRecoveryRequestContext): Promise<void> {
  const throttleResult = await evaluatePasswordRecoveryThrottle();

  if (!throttleResult.allowed) {
    return;
  }

  void email;
  void request;
  void token;
  void url;
}
