import path from 'path';
import { spawnSync } from 'child_process';

if (!process.env.MARITIME_BORDER_CHECKER_SCRIPT) {
    throw new Error('MARITIME_BORDER_CHECKER_SCRIPT environment variable is not set');
}

const maritime_border_checker_script = path.resolve(process.env.MARITIME_BORDER_CHECKER_SCRIPT);

export default async function checkMaritimeBorder(location: string) {
    const location_vector = location.split(',').map(coord => parseFloat(coord.trim()));
    const [latitude, longitude] = location_vector;

    const check_args = [
        maritime_border_checker_script,
        `${latitude}`,
        `${longitude}`
    ];

    const check_process = spawnSync("python", check_args);

    if (check_process.status !== 0) {
        throw new Error(`Maritime border check failed: ${check_process.stderr.toString()}`);
    }

    const result = check_process.stdout.toString();
    return result.trim() === 'True';
}