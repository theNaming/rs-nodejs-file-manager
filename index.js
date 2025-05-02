import { homedir, userInfo, EOL, cpus, arch } from 'os';
import { createInterface } from 'readline';
import { chdir, cwd, stdin, stdout, exit } from 'process';
import { 
  readdir, stat, mkdir, rename, rm, copyFile, 
  readFile, writeFile, open, constants 
} from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { createBrotliCompress, createBrotliDecompress } from 'zlib';
import { createHash } from 'crypto';

class FileManager {
  constructor(username) {
    this.username = username;
    this.rl = createInterface({ input: stdin, output: stdout });
    this.init();
  }

  async init() {
    chdir(homedir());
    console.log(`Welcome to the File Manager, ${this.username}!`);
    this.showCurrentPath();
    this.prompt();
  }

  showCurrentPath() {
    console.log(`You are currently in ${cwd()}\n`);
  }

  prompt() {
    this.rl.question('> ', async (input) => {
      if (input === '.exit') return this.exit();
      
      const [cmd, ...args] = input.trim().split(/\s+/);
      try {
        await this.handleCommand(cmd, args);
      } catch {
        console.log('Operation failed');
      } finally {
        this.prompt();
      }
    });
  }

  async handleCommand(cmd, args) {
    const commands = {
      up: () => this.navigateUp(),
      cd: () => this.navigateTo(args[0]),
      ls: () => this.listFiles(),
      cat: () => this.readFile(args[0]),
      add: () => this.createFile(args[0]),
      rn: () => this.renameFile(args[0], args[1]),
      cp: () => this.copyFile(args[0], args[1]),
      mv: () => this.moveFile(args[0], args[1]),
      rm: () => this.deleteFile(args[0]),
      mkdir: () => this.createDir(args[0]),
      os: () => this.osInfo(args[0]),
      hash: () => this.calculateHash(args[0]),
      compress: () => this.compressFile(args[0], args[1]),
      decompress: () => this.decompressFile(args[0], args[1]),
    };

    if (commands[cmd]) await commands[cmd]();
    else if (cmd) console.log('Invalid input');
  }

  // Navigation
  async navigateUp() {
    const current = cwd();
    if (current !== homedir()) chdir('..');
    this.showCurrentPath();
  }

  async navigateTo(path) {
    if (!path) throw new Error();
    const target = resolve(path);
    await stat(target);
    chdir(target);
    this.showCurrentPath();
  }

  // File handling
  async listFiles() {
    const items = await readdir(cwd());
    const sorted = (await Promise.all(items.map(async item => {
      const stats = await stat(join(cwd(), item));
      return {
        name: item,
        type: stats.isDirectory() ? 'directory' : 'file'
      };
    }))).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

    console.table(sorted);
  }

  async readFile(path) {
    if (!path) throw new Error();
    const stream = createReadStream(resolve(path), { encoding: 'utf8' });
    stream.pipe(stdout);
    await new Promise(res => stream.on('end', res));
  }

  async createFile(name) {
    if (!name) throw new Error();
    await writeFile(resolve(name), '');
  }

  async renameFile(oldPath, newName) {
    if (!oldPath || !newName) throw new Error();
    await rename(resolve(oldPath), join(dirname(resolve(oldPath)), newName));
  }

  async copyFile(src, dest) {
    if (!src || !dest) throw new Error();
    await copyFile(resolve(src), resolve(dest));
  }

  async moveFile(src, dest) {
    await this.copyFile(src, dest);
    await this.deleteFile(src);
  }

  async deleteFile(path) {
    if (!path) throw new Error();
    await rm(resolve(path));
  }

  async createDir(name) {
    if (!name) throw new Error();
    await mkdir(resolve(name));
  }

  // System information
  async osInfo(arg) {
    const info = {
      '--EOL': JSON.stringify(EOL),
      '--cpus': cpus().map(cpu => ({
        model: cpu.model.split('@')[0].trim(),
        speed: `${cpu.speed / 1000} GHz`
      })),
      '--homedir': homedir(),
      '--username': userInfo().username,
      '--architecture': arch()
    };

    console.log(arg ? info[arg] || 'Invalid argument' : info);
  }

  // Hashing and compression
  async calculateHash(path) {
    if (!path) throw new Error();
    const hash = createHash('sha256');
    const stream = createReadStream(resolve(path));
    stream.pipe(hash).setEncoding('hex');
    hash.on('finish', () => console.log(hash.read()));
    await new Promise(res => stream.on('end', res));
  }

  async compressFile(src, dest) {
    if (!src || !dest) throw new Error();
    const read = createReadStream(resolve(src));
    const write = createWriteStream(resolve(dest));
    const compress = createBrotliCompress();
    read.pipe(compress).pipe(write);
    await new Promise(res => write.on('finish', res));
  }

  async decompressFile(src, dest) {
    if (!src || !dest) throw new Error();
    const read = createReadStream(resolve(src));
    const write = createWriteStream(resolve(dest));
    const decompress = createBrotliDecompress();
    read.pipe(decompress).pipe(write);
    await new Promise(res => write.on('finish', res));
  }

  exit() {
    console.log(`Thank you for using File Manager, ${this.username}, goodbye!`);
    this.rl.close();
    exit(0);
  }
}

// go
const username = process.argv.find(arg => arg.startsWith('--username='))?.split('=')[1] || 'Guest';
new FileManager(username);