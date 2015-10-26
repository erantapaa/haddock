
module Haddock.Backends.MyBackend
where

import GHC
-- import Outputable
import Data.Version
-- import System.FilePath

import Haddock.Types hiding (Version)

ppMyBackend :: DynFlags -> String -> Version -> String -> Maybe (Doc RdrName) -> [Interface] -> FilePath -> IO ()
ppMyBackend dflags package version synopsis prologue ifaces odir = do
  putStrLn "Got here"

ppModule :: DynFlags -> Interface -> [String]
ppModule dflags iface =
  undefined
  where
    modl    = moduleNameString $ moduleName $ ifaceMod iface -- :: String
    src     = ifaceOrigFilename iface                        -- :: FilePath

