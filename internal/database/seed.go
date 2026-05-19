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
			{Name: "Framebuffer", Slug: "display-fb", Icon: "monitor"},
			{Name: "VOP", Slug: "display-vop", Icon: "cpu"},
		},
	},
	{
		Name: "Camera", Slug: "camera", Icon: "camera",
		Children: []bspSeed{
			{Name: "V4L2 Framework", Slug: "camera-v4l2", Icon: "layers"},
			{Name: "ISP", Slug: "camera-isp", Icon: "image"},
			{Name: "MIPI CSI", Slug: "camera-csi", Icon: "cable"},
			{Name: "Sensor", Slug: "camera-sensor", Icon: "cpu"},
			{Name: "Video Encoder", Slug: "camera-venc", Icon: "film"},
		},
	},
	{
		Name: "Audio", Slug: "audio", Icon: "volume-2",
		Children: []bspSeed{
			{Name: "ALSA / ASoC", Slug: "audio-alsa", Icon: "layers"},
			{Name: "I2S / TDM / PDM", Slug: "audio-i2s", Icon: "cable"},
			{Name: "Codec", Slug: "audio-codec", Icon: "cpu"},
			{Name: "HDMI Audio", Slug: "audio-hdmi", Icon: "cable"},
		},
	},
	{
		Name: "Storage", Slug: "storage", Icon: "hard-drive",
		Children: []bspSeed{
			{Name: "eMMC / SD", Slug: "storage-emmc", Icon: "disc"},
			{Name: "SPI NAND / NOR", Slug: "storage-spi", Icon: "disc"},
			{Name: "NVMe", Slug: "storage-nvme", Icon: "zap"},
			{Name: "SATA", Slug: "storage-sata", Icon: "hard-drive"},
			{Name: "UBI / UBIFS", Slug: "storage-ubi", Icon: "disc"},
		},
	},
	{
		Name: "Clock / Power", Slug: "clock-power", Icon: "clock",
		Children: []bspSeed{
			{Name: "CLK Framework", Slug: "clk-framework", Icon: "layers"},
			{Name: "Regulator", Slug: "clk-regulator", Icon: "gauge"},
			{Name: "PM Domain / Suspend", Slug: "clk-pm", Icon: "moon"},
			{Name: "Reset", Slug: "clk-reset", Icon: "rotate-ccw"},
			{Name: "Thermal", Slug: "clk-thermal", Icon: "thermometer"},
		},
	},
	{
		Name: "Connectivity", Slug: "connectivity", Icon: "wifi",
		Children: []bspSeed{
			{Name: "USB (dwc3 / xhci)", Slug: "conn-usb", Icon: "usb"},
			{Name: "PCIe", Slug: "conn-pcie", Icon: "cpu"},
			{Name: "Ethernet", Slug: "conn-eth", Icon: "network"},
			{Name: "WiFi / BT", Slug: "conn-wifi-bt", Icon: "wifi"},
			{Name: "CAN", Slug: "conn-can", Icon: "cable"},
			{Name: "Modem / 4G/5G", Slug: "conn-modem", Icon: "radio"},
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
			{Name: "ADC / DAC", Slug: "periph-adc", Icon: "activity"},
			{Name: "Timer / Watchdog", Slug: "periph-timer", Icon: "clock"},
			{Name: "RTC", Slug: "periph-rtc", Icon: "clock"},
		},
	},
	{
		Name: "Boot / Firmware", Slug: "boot-firmware", Icon: "power",
		Children: []bspSeed{
			{Name: "U-Boot", Slug: "boot-uboot", Icon: "terminal"},
			{Name: "ATF / OPTEE", Slug: "boot-atf", Icon: "shield"},
			{Name: "Device Tree", Slug: "boot-dt", Icon: "file-text"},
			{Name: "UEFI", Slug: "boot-uefi", Icon: "file-text"},
			{Name: "SPL / TPL", Slug: "boot-spl", Icon: "power"},
		},
	},
	{
		Name: "Kernel", Slug: "kernel", Icon: "cpu",
		Children: []bspSeed{
			{Name: "Scheduler / Process", Slug: "kernel-sched", Icon: "layers"},
			{Name: "Memory Management", Slug: "kernel-mm", Icon: "database"},
			{Name: "Interrupt / IRQ", Slug: "kernel-irq", Icon: "zap"},
			{Name: "DMA / IOMMU", Slug: "kernel-dma", Icon: "shuffle"},
			{Name: "Module / Kconfig", Slug: "kernel-module", Icon: "package"},
			{Name: "Locking / Synchronization", Slug: "kernel-lock", Icon: "lock"},
		},
	},
	{
		Name: "Filesystem", Slug: "filesystem", Icon: "folder",
		Children: []bspSeed{
			{Name: "VFS", Slug: "fs-vfs", Icon: "layers"},
			{Name: "ext4 / FAT32", Slug: "fs-ext4", Icon: "hard-drive"},
			{Name: "JFFS2 / SquashFS", Slug: "fs-jffs2", Icon: "archive"},
			{Name: "OverlayFS / UnionFS", Slug: "fs-overlay", Icon: "layers"},
			{Name: "NFS / CIFS", Slug: "fs-nfs", Icon: "network"},
		},
	},
	{
		Name: "Network", Slug: "network", Icon: "network",
		Children: []bspSeed{
			{Name: "Netfilter / iptables", Slug: "net-filter", Icon: "shield"},
			{Name: "TCP/IP Stack", Slug: "net-tcpip", Icon: "layers"},
			{Name: "Bridge / VLAN", Slug: "net-bridge", Icon: "git-branch"},
			{Name: "Socket / Netlink", Slug: "net-socket", Icon: "plug"},
			{Name: "DPDK / XDP", Slug: "net-dpdk", Icon: "zap"},
		},
	},
	{
		Name: "Multimedia", Slug: "multimedia", Icon: "film",
		Children: []bspSeed{
			{Name: "VPU / Video Codec", Slug: "mm-vpu", Icon: "film"},
			{Name: "GPU / OpenGL ES", Slug: "mm-gpu", Icon: "monitor"},
			{Name: "JPEG / Image Processing", Slug: "mm-jpeg", Icon: "image"},
			{Name: "RGA / 2D Acceleration", Slug: "mm-rga", Icon: "layers"},
		},
	},
	{
		Name: "Debug / Tools", Slug: "debug-tools", Icon: "terminal",
		Children: []bspSeed{
			{Name: "Kernel Log / dmesg", Slug: "debug-dmesg", Icon: "file-text"},
			{Name: "Ftrace / Perf", Slug: "debug-ftrace", Icon: "activity"},
			{Name: "Devmem / Regs", Slug: "debug-reg", Icon: "cpu"},
			{Name: "GDB / KGDB", Slug: "debug-gdb", Icon: "bug"},
			{Name: "Crash / Panic Analysis", Slug: "debug-crash", Icon: "alert-triangle"},
		},
	},
	{
		Name: "Hardware", Slug: "hardware", Icon: "cpu",
		Children: []bspSeed{
			{Name: "Schematic / Datasheet", Slug: "hw-schematic", Icon: "file-text"},
			{Name: "PCB / Signal Integrity", Slug: "hw-pcb", Icon: "layers"},
			{Name: "Power Supply", Slug: "hw-psu", Icon: "battery"},
			{Name: "EMC / ESD", Slug: "hw-emc", Icon: "shield"},
		},
	},
	{
		Name: "Build System", Slug: "build-system", Icon: "package",
		Children: []bspSeed{
			{Name: "Yocto / BitBake", Slug: "build-yocto", Icon: "package"},
			{Name: "Buildroot", Slug: "build-buildroot", Icon: "package"},
			{Name: "Kernel Defconfig", Slug: "build-defconfig", Icon: "settings"},
			{Name: "Cross Compile / Toolchain", Slug: "build-toolchain", Icon: "wrench"},
			{Name: "CI / Automated Testing", Slug: "build-ci", Icon: "git-branch"},
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
