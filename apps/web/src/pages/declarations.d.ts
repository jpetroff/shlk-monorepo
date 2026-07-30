declare type PageRouterProps = {
  location: import('react-router').Location
  params: Readonly<import('react-router').Params<string>>
  navigate: import('react-router').NavigateFunction
}

declare type PageExtensionProps = {
  activeTabUrl?: string
}