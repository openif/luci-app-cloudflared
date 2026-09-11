# Copyright (C) 2024-2026 luci-app-cloudflared contributors
# This is free software, licensed under the Apache License, Version 2.0

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-cloudflared
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_TITLE:=LuCI for Cloudflare Zero Trust Tunnel
LUCI_DEPENDS:=+cloudflared
LUCI_PKGARCH:=all
LUCI_DESCRIPTION:=LuCI interface for managing Cloudflare Zero Trust Tunnels \
 (cloudflared). Features a real-time status dashboard, basic and advanced \
 configuration, and full Chinese localization.

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=OpenIF <https://github.com/openif>

include $(firstword $(wildcard $(TOPDIR)/feeds/luci/luci.mk ../../luci.mk))

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,$(PKG_NAME)))
