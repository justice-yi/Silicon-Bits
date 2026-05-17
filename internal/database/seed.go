package database

import "log"

type bspSeed struct {
	Name      string
	Slug      string
	Icon      string
	Children  []bspSeed
}

var bspTree = []bspSeed{
	{
		Name: "Display", Slug: "display", Icon: "monitor",
		Children: []bspSeed{
			{Name: "DRM Framework", Slug: "display-drm", Icon: "layers"},
			{Name: "HDMI", Slug: "display-hdmi", Icon: "cable"},
			{Name: "DisplayPort", Slug: "display-dp", Icon: "cable"},
			{Name: "MIPI DSI", Slug: "display-dsi", Icon: "cable"},
			{Name: "Panel / Backlight", Slug: "display-panel", Icon: "brightness"},
		},
	},
	{
		Name: "Camera", Slug: "camera", Icon: "camera",
		Children: []bspSeed{
			{Name: "V4L2 Framework", Slug: "camera-v4l2", Icon: "layers"},
			{Name: "ISP", Slug: "camera-isp", Icon: "image"},
			{Name: "MIPI CSI", Slug: "camera-csi", Icon: "cable"},
			{Name: "Sensor", Slug: "camera-sensor", Icon: "cpu"},
		},
	},
	{
		Name: "Audio", Slug: "audio", Icon: "volume-2",
		Children: []bspSeed{
			{Name: "ALSA / ASoC", Slug: "audio-alsa", Icon: "layers"},
			{Name: "I2S / TDM / PDM", Slug: "audio-i2s", Icon: "cable"},
			{Name: "Codec", Slug: "audio-codec", Icon: "cpu"},
		},
	},
	{
		Name: "Storage", Slug: "storage", Icon: "hard-drive",
		Children: []bspSeed{
			{Name: "eMMC / SD", Slug: "storage-emmc", Icon: "disc"},
			{Name: "SPI NAND / NOR", Slug: "storage-spi", Icon: "disc"},
			{Name: "NVMe", Slug: "storage-nvme", Icon: "zap"},
		},
	},
	{
		Name: "Clock / Power", Slug: "clock-power", Icon: "clock",
		Children: []bspSeed{
			{Name: "CLK Framework", Slug: "clk-framework", Icon: "layers"},
			{Name: "Regulator", Slug: "clk-regulator", Icon: "gauge"},
			{Name: "PM Domain / Suspend", Slug: "clk-pm", Icon: "moon"},
		},
	},
	{
		Name: "Connectivity", Slug: "connectivity", Icon: "wifi",
		Children: []bspSeed{
			{Name: "USB (dwc3 / xhci)", Slug: "conn-usb", Icon: "usb"},
			{Name: "PCIe", Slug: "conn-pcie", Icon: "cpu"},
			{Name: "Ethernet", Slug: "conn-eth", Icon: "network"},
			{Name: "WiFi / BT", Slug: "conn-wifi-bt", Icon: "wifi"},
		},
	},
	{
		Name: "Peripheral", Slug: "peripheral", Icon: "settings-2",
		Children: []bspSeed{
			{Name: "I2C", Slug: "periph-i2c", Icon: "cable"},
			{Name: "SPI", Slug: "periph-spi", Icon: "cable"},
			{Name: "UART", Slug: "periph-uart", Icon: "terminal"},
			{Name: "GPIO / Pinctrl", Slug: "periph-gpio", Icon: "git-branch"},
			{Name: "PWM", Slug: "periph-pwm", Icon: "activity"},
		},
	},
	{
		Name: "Boot / Firmware", Slug: "boot-firmware", Icon: "power",
		Children: []bspSeed{
			{Name: "U-Boot", Slug: "boot-uboot", Icon: "terminal"},
			{Name: "ATF / OPTEE", Slug: "boot-atf", Icon: "shield"},
			{Name: "Device Tree", Slug: "boot-dt", Icon: "file-text"},
		},
	},
}

// SeedBSPModules populates the bsp_modules table if empty.
func SeedBSPModules() error {
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM bsp_modules").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil // already seeded
	}

	log.Println("Seeding BSP module tree...")
	for i, cat := range bspTree {
		var parentID int64
		err := DB.QueryRow(
			"INSERT INTO bsp_modules (name, slug, icon, sort_order) VALUES (?, ?, ?, ?) RETURNING id",
			cat.Name, cat.Slug, cat.Icon, i,
		).Scan(&parentID)
		if err != nil {
			return err
		}
		for j, child := range cat.Children {
			_, err := DB.Exec(
				"INSERT INTO bsp_modules (parent_id, name, slug, icon, sort_order) VALUES (?, ?, ?, ?, ?)",
				parentID, child.Name, child.Slug, child.Icon, j,
			)
			if err != nil {
				return err
			}
		}
	}
	log.Println("BSP module tree seeded.")
	return nil
}
