declare module 'argon2' {
  export function hash(...args: any[]): Promise<string>;
  export function verify(...args: any[]): Promise<boolean>;
  const argon2: any;
  export default argon2;
}
