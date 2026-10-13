import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import { DatabaseModule } from '../../db/database.module';
import { BackupModule } from './backup.module';
import { BackupService } from './backup.service';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, BackupModule] })
class BackupCliModule {}

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (!['create', 'list', 'import', 'restore'].includes(command) ||
      (['import', 'restore'].includes(command) && !argument)) {
    throw new Error('Usage: backup.cli.js create [retention_days] | list | import <file.dump|file.sql.gz> | restore <filename.dump>');
  }
  if (command === 'restore') {
    const prompt = createInterface({ input: stdin, output: stdout });
    const abort = new AbortController();
    prompt.once('close', () => abort.abort());
    try {
      const confirmation = await prompt.question('Stop the API and workers first. Restore replaces CRM data and signs out everyone. Type RESTORE: ', { signal: abort.signal });
      if (confirmation !== 'RESTORE') throw new Error('Restore cancelled.');
    } catch { throw new Error('Restore cancelled. Type RESTORE explicitly to proceed.');
    } finally { prompt.close(); }
  }
  const app = await NestFactory.createApplicationContext(BackupCliModule, { logger: false, abortOnError: false });
  try {
    const backups = app.get(BackupService);
    const result = command === 'create' ? await backups.createBackup(argument === undefined ? undefined : Number(argument))
      : command === 'list' ? backups.listBackups()
      : command === 'import' ? await backups.importBackup(argument)
      : await backups.restoreBackup(argument);
    stdout.write(JSON.stringify(result, null, 2) + '\n');
  } finally { await app.close(); }
}

main().catch(error => {
  // Connection errors can contain credentials. Only expose our application errors.
  const message = error?.getResponse?.()?.message;
  console.error(message || (error instanceof Error && /^(Usage:|Restore cancelled)/.test(error.message)
    ? error.message : 'Backup command failed. Check configuration, database connectivity, and PostgreSQL tools.'));
  process.exitCode = 1;
});
