import { readConfig } from "$lib/server/config";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const config = await readConfig();
  return {
    buttons: config.buttons,
    gridSize: config.grid_size,
    selectedDeviceId: config.selected_device_id,
  };
};
