package com.cobblemine.auth.mixin;
import net.minecraft.network.ClientConnection;
import net.minecraft.server.network.ServerCommonNetworkHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
@Mixin(ServerCommonNetworkHandler.class)
public interface CommonAccess { @Accessor("connection") ClientConnection cobblemineConnection(); }
