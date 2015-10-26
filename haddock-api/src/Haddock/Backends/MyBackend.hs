{-# LANGUAGE GADTs, RankNTypes, PatternGuards #-}

module Haddock.Backends.MyBackend
where

import GHC
import CoreSyn (isId)
import Id (idName, isDictId)
import FastString (FastString(..), unpackFS, fsLit)
import Name (nameSrcSpan)
import NameSet (NameSet(..))
import Outputable (showPpr, neverQualify, showSDocForUser)
import PprTyThing (pprTyThing)

import Data.Version
-- import System.FilePath
import qualified Data.List as L
import GHC.Exts (groupWith)
import qualified Data.Map as M

import Haddock.Types hiding (Version)

import Data.Data
import Data.Generics.Aliases hiding (GT)
import Data.Maybe (isJust)
import System.IO
import System.FilePath

ppMyBackend :: DynFlags -> String -> Version -> String -> Maybe (Doc RdrName) -> [Interface] -> FilePath -> IO ()
ppMyBackend dflags package version synopsis prologue ifaces odir = do
  putStrLn "Got here"

ppModule :: DynFlags -> Interface -> [String]
ppModule dflags iface =
  undefined
  where
    modl    = moduleNameString $ moduleName $ ifaceMod iface -- :: String
    src     = ifaceOrigFilename iface                        -- :: FilePath

--------------------------------

ppAnnot :: DynFlags -> [Interface] -> FilePath -> FilePath -> IO ()
ppAnnot dflags ifaces odir file
  = do putStrLn $ "Writing Annots to: " ++ target
       withFile target WriteMode $ \h -> mapM_ (render dflags h) ifaces
    where target = odir </> file

render :: DynFlags -> Handle -> Interface -> IO ()
render dflags annH iface
  = do putStrLn $ "Render Annot: src = " ++ src ++ " module = " ++ modl
       hPutStr annH annots
    where src     = ifaceOrigFilename iface
          modl    = moduleNameString $ moduleName $ ifaceMod iface
          annots  = show_AnnMap modl $ getAnnMap dflags src $ ifaceTypecheckedSrc iface

--------------------------------

type Loc = RealSrcSpan

newtype AnnMap = Ann (M.Map Loc (String, String))

show_AnnMap :: String -> AnnMap -> String
show_AnnMap modl (Ann m)  = "\n\n" ++ (concatMap ppAnn $ M.toList m)
    where ppAnn (l, (x,s)) =  x ++ "\n"
                           ++ modl ++ "\n"
                           ++ show (srcSpanStartLine l) ++ "\n"
                           ++ show (srcSpanStartCol l)  ++ "\n"
                           ++ show (length $ lines s)   ++ "\n"
                           ++ s ++ "\n\n\n"
          --spanFile         = takeFileName . unpackFS . srcSpanFile

getAnnMap ::  Data a => DynFlags -> String -> a -> AnnMap
getAnnMap dflags src tcm  = Ann $ M.fromList $ canonize $ anns
  where anns   = [(l, (s, renderId dflags x)) | (l, (s, x)) <- rs ++ ws ]
        rs     = [(l, (s, x)) | (_,l,s) <- getLocEs dflags tcm, x <- typs s]
        ws     = [(l, (s, x)) | (s, (x, Just l)) <- ns]
        ns     = getNames dflags src tcm
        tm     = M.fromList ns
        typs s = case s `M.lookup` tm of
                   Nothing    -> []
                   Just (x,_) -> [x]

getNames ::  (Data a) => DynFlags -> FilePath -> a -> [(String, (Id, Maybe Loc))]
getNames dflags srcName z =
   [(showPpr dflags x, (x, y))
        | x <- findIds z, idOk x
        , let y = idLoc (fsLit srcName) x
   ]
  where idOk = not . isDictId

getLocEs ::  (Data a) => DynFlags -> a -> [(HsExpr Id, Loc, String)]
getLocEs dflags z = [(e, l, stripParens $ showPpr dflags e) | L l' e <- findLEs z,
                               let Just l = toRealSrcSpan l' ]
  where stripParens ('(':s)  = stripParens s
        stripParens s        = stripRParens (reverse s)
        stripRParens (')':s) = stripRParens s
        stripRParens s       = reverse s

canonize :: (Ord b, Eq a) => [(b, (t, [a]))] -> [(b, (t, [a]))]
canonize anns = map (head . L.sortBy cmp) $ groupWith fst anns
  where cmp (_,(_,x1)) (_,(_,x2))
          | x1 == x2              = EQ
          | length x1 < length x2 = GT
          | otherwise             = LT

--------------------------------

renderId :: DynFlags -> Id -> String
renderId dflags = showSDocForUser dflags neverQualify . pprTyThing . AnId

toRealSrcSpan :: SrcSpan -> Maybe RealSrcSpan
toRealSrcSpan (UnhelpfulSpan _) = Nothing
toRealSrcSpan (RealSrcSpan sp)  = Just sp

idLoc :: FastString -> Id -> Maybe Loc
idLoc src x
  | not (isGoodSrcSpan sp)
  = Nothing
  | Just rspan <- toRealSrcSpan sp,
    src  == srcSpanFile rspan
  = Just rspan
  | otherwise
  = Nothing
  where sp  = nameSrcSpan $ idName x

findLEs :: Data a => a -> [LHsExpr Id]
findLEs a = listifyBut (isGoodSrcSpan . getLoc) skipGuards a

findIds :: Data a => a -> [Id]
findIds a = listifyBut isId skipGuards a

data Guard where
  Guard :: Typeable a => Maybe a -> Guard

isPost :: Typeable a => a -> [Guard] -> Bool
isPost a = or . map check
  where check :: Guard -> Bool
        check x = case x of
                    Guard y -> isJust $ (cast a) `asTypeOf` y

skipGuards :: [Guard]
skipGuards = [ Guard (undefined :: Maybe NameSet)
             --, Guard (undefined :: Maybe PostTcKind)]
             ]

-- | Summarise all nodes in top-down, left-to-right order
everythingButQ :: (r -> r -> r) -> [Guard] -> GenericQ r -> GenericQ r
everythingButQ k q f x
  = foldl k (f x) fsp
    where fsp = case isPost x q of
                  True  -> []
                  False -> gmapQ (everythingButQ k q f) x

-- | Get a list of all entities that meet a predicate
listifyBut :: Typeable r => (r -> Bool) -> [Guard] -> GenericQ [r]
listifyBut p q
  = everythingButQ (++) q ([] `mkQ` (\x -> if p x then [x] else []))

