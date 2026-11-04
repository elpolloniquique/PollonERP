export function normalizarRut(entrada: string): { guardado: string; visible: string } | { error: string } {
  const limpio = entrada.trim().toUpperCase().replace(/[^0-9K]/g, "");
  if (!limpio) return { error: "Escriba el RUT." };
  if (limpio.length < 2) return { error: "El RUT está incompleto." };
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return { error: "El RUT solo puede tener números y el dígito verificador." };
  const esperado = digitoVerificador(cuerpo);
  if (dv !== esperado) return { error: `El RUT no es válido. El dígito verificador debería ser ${esperado}.` };
  return { guardado: `${cuerpo}-${dv}`, visible: mostrarRut(`${cuerpo}-${dv}`) };
}

export function mostrarRut(guardado: string): string {
  const [cuerpo, dv] = guardado.split("-");
  if (!cuerpo || !dv) return guardado;
  let visible = "";
  let cuenta = 0;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    if (cuenta === 3) {
      visible = `.${visible}`;
      cuenta = 0;
    }
    visible = cuerpo[i] + visible;
    cuenta++;
  }
  return `${visible}-${dv}`;
}

function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}
