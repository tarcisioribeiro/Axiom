import { useState } from 'react';

const IS_MAC = /Mac/i.test(navigator.platform);

/** Detecta Caps Lock num campo de senha; espalhe `inputProps` no `<Input>`. */
export function useCapsLock() {
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'CapsLock') {
      setCapsLockOn(e.getModifierState('CapsLock'));
      return;
    }
    // No próprio CapsLock, getModifierState é inconsistente (Chrome/Linux ainda
    // reporta "ligado" ao desligar): alterna uma vez por toque. No macOS o
    // desligar só dispara keyup, e lá o valor do keyup é confiável.
    if (e.type === 'keydown') setCapsLockOn((on) => !on);
    else if (IS_MAC) setCapsLockOn(e.getModifierState('CapsLock'));
  };

  return {
    capsLockOn,
    inputProps: {
      onKeyDown: handleKey,
      onKeyUp: handleKey,
      onBlur: () => setCapsLockOn(false),
    },
  };
}
