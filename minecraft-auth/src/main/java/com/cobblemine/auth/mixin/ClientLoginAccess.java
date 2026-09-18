package com.cobblemine.auth.mixin;
import net.minecraft.client.network.ClientLoginNetworkHandler;
import net.minecraft.client.network.ServerInfo;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
@Mixin(ClientLoginNetworkHandler.class)
public interface ClientLoginAccess { @Accessor("serverInfo") ServerInfo cobblemineServerInfo(); }
