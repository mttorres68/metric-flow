import * as dotenv from 'dotenv';
dotenv.config();
import { loadGoogleSheetsData } from './server/services/xlsxService.ts';

async function run() {
    console.log('Testing First Load...');
    const t0 = Date.now();
    await loadGoogleSheetsData();
    console.log(`First load time: ${Date.now() - t0}ms\n`);

    console.log('Testing Second Load...');
    const t1 = Date.now();
    await loadGoogleSheetsData();
    console.log(`Second load time: ${Date.now() - t1}ms`);
}
run();
