export function spokenMathToExpression(input: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\b(opening|open)\s+parenthesis\b/gi, "("],
    [/\b(closing|close)\s+parenthesis\b/gi, ")"],
    [/\bsquare root of\b/gi, "sqrt("],
    [/\bcube root of\b/gi, "cbrt("],
    [/\bto the power of\b|\braised to\b/gi, "^"],
    [/\bmultiplied by\b|\btimes\b/gi, "*"],
    [/\bdivided by\b/gi, "/"],
    [/\bplus\b/gi, "+"],
    [/\bminus\b|\bsubtract\b/gi, "-"],
    [/\bpoint\b/gi, "."],
    [/\bpi\b/gi, "pi"],
    [/\bsine\b/gi, "sin"],
    [/\bcosine\b/gi, "cos"],
    [/\btangent\b/gi, "tan"],
    [/\bsquared\b/gi, "^2"],
    [/\bcubed\b/gi, "^3"],
    [/\bone\b/gi, "1"], [/\btwo\b/gi, "2"], [/\bthree\b/gi, "3"],
    [/\bfour\b/gi, "4"], [/\bfive\b/gi, "5"], [/\bsix\b/gi, "6"],
    [/\bseven\b/gi, "7"], [/\beight\b/gi, "8"], [/\bnine\b/gi, "9"],
    [/\bzero\b/gi, "0"]
  ];
  let result = input.trim().toLowerCase();
  for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement);
  // Close the parenthesis opened by "square root of" if user did not dictate one.
  const opens = (result.match(/sqrt\(/g) ?? []).length;
  const closes = (result.match(/\)/g) ?? []).length;
  if (opens > closes) result += ")".repeat(opens - closes);
  return result.replace(/\s+/g, "");
}
