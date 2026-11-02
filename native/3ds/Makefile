TARGET := openlink_3ds
BUILD := build
SOURCE := source
SERVER_URL ?= https://openlink-server.onrender.com/health

ARCH := -march=armv6k -mtune=mpcore -mfloat-abi=hard -mtp=soft
INCLUDE := -I$(CURDIR) -I$(DEVKITPRO)/libctru/include
CFLAGS := -g -Wall -Wextra -O2 -mword-relocations -ffunction-sections $(ARCH) -D__3DS__ $(INCLUDE)
CFLAGS += -DOPENLINK_SERVER_URL=\"$(SERVER_URL)\"
LDFLAGS := -specs=3dsx.specs -g $(ARCH) -Wl,--gc-sections -L$(DEVKITPRO)/libctru/lib
LIBS := -lctru -lm

CC := $(DEVKITPRO)/devkitARM/bin/arm-none-eabi-gcc
3DSXTOOL := $(DEVKITPRO)/tools/bin/3dsxtool
OFILES := $(BUILD)/main.o

.PHONY: all clean

all: $(TARGET).3dsx

$(TARGET).3dsx: $(TARGET).elf
	$(3DSXTOOL) $< $@

$(TARGET).elf: $(OFILES)
	$(CC) $(LDFLAGS) $^ $(LIBS) -o $@

$(BUILD)/main.o: $(SOURCE)/main.c
	@mkdir -p $(@D)
	$(CC) $(CFLAGS) -MMD -MP -MF $(BUILD)/main.d -c $< -o $@

clean:
	rm -rf $(BUILD) $(TARGET).elf $(TARGET).3dsx

-include $(BUILD)/*.d
