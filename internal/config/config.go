package config

import "os"

type Config struct {
	Port     string
	DBPath   string
	Username string
	Password string
	DataDir  string
}

func Load() *Config {
	dataDir := getEnv("DATA_DIR", "./data")
	return &Config{
		Port:     getEnv("PORT", "8080"),
		DBPath:   getEnv("DB_PATH", dataDir+"/silicon.db"),
		Username: getEnv("AUTH_USERNAME", "admin"),
		Password: getEnv("AUTH_PASSWORD", "silicon"),
		DataDir:  dataDir,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
